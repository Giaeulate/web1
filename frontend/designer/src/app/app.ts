import { Component, ViewChild, signal, effect, OnDestroy, AfterViewInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import Konva from 'konva';

import {
  NgxKonvaModule,
  KoStageComponent,
  KoLayerComponent,
} from 'ngx-konva';

import { DJANGO_CONFIG, DjangoConfig } from '../main';

type Tool = 'select' | 'rect' | 'ellipse' | 'poly';
type ShapeKind = 'rect' | 'ellipse' | 'poly';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, FormsModule, NgxKonvaModule],
  templateUrl: './app.html',
  styleUrls: ['./app.scss'],
})
export class App implements AfterViewInit, OnDestroy {
  cfg: DjangoConfig = inject(DJANGO_CONFIG);
  protected readonly title = signal('designer');

  @ViewChild('stageRef', { static: true }) stageRef!: KoStageComponent;
  @ViewChild('drawLayerRef', { static: true }) drawLayerRef!: KoLayerComponent;
  @ViewChild('uiLayerRef',   { static: true }) uiLayerRef!: KoLayerComponent;

  // Stage
  stageConfig = { width: 1200, height: 800, draggable: false };
  minScale = 0.2;
  maxScale = 4;

  // UI state
  tool         = signal<Tool>('select');
  isPanning    = signal(false);
  spacePressed = signal(false);
  selectedId   = signal<string | null>(null);

  // Background color (single color)
  bgColor = signal<string>('#f5f7fb');

  // Polygon draft (snap al primer vértice)
  polyDraftPoints = signal<number[]>([]);
  isDrawingPoly   = signal(false);
  firstVertex     = signal<{x:number,y:number} | null>(null);
  showMagnet      = signal(false);
  magnetRadius    = 10;

  // Polygon vertex edit mode
  editingVertices = signal(false);

  // ResizeObserver + debounce
  private ro?: ResizeObserver;
  private fitTimer?: any;

  // History (undo/redo)
  private undoStack: string[][] = [];
  private redoStack: string[][] = [];
  private suppressHistory = false;
  private clipboardJSON: string[] | null = null;

  // Prop panel state
  propTitle = signal('');
  propDesc  = signal('');
  propInvalidMsg = signal<string | null>(null);

  private _noopEffect = effect(() => void 0);

  // ==== Public helpers for template (evita instanceof en HTML) ====
  /** ¿La figura seleccionada es un polígono? (para habilitar botón "Editar vértices") */
  isSelectedPolygon(): boolean {
    const node = this.getSelectedNode();
    return !!node && node instanceof Konva.Line;
  }

  get userName(): string {
    return (this.cfg as any)?.user?.name ?? 'anónimo';
  }

  // ---- Safe access to Konva instances (distintas versiones de ngx-konva) ----
  private get stage(): Konva.Stage {
    const s = this.stageRef as any;
    return (s.getStage?.() as Konva.Stage) || (s.stage as Konva.Stage);
  }
  private get drawLayer(): Konva.Layer {
    const l = this.drawLayerRef as any;
    return (l.getLayer?.() as Konva.Layer) || (l.layer as Konva.Layer);
  }
  private get uiLayer(): Konva.Layer {
    const l = this.uiLayerRef as any;
    return (l.getLayer?.() as Konva.Layer) || (l.layer as Konva.Layer);
  }

  // ===== Ciclo de vida =====
  ngAfterViewInit() {
    setTimeout(() => {
      this.fitStageToContainer();
      this.attachStageEvents();
      this.stage.batchDraw();
      this.pushHistory(); // estado inicial
    }, 0);

    const container = document.getElementById('designer-container');
    if (container) {
      this.ro = new ResizeObserver(() => {
        clearTimeout(this.fitTimer);
        this.fitTimer = setTimeout(() => this.fitStageToContainer(), 40);
      });
      this.ro.observe(container);
    }

    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
  }

  ngOnDestroy() {
    this.ro?.disconnect();
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
  }

  // ===== Layout =====
  private fitStageToContainer = () => {
    const container = document.getElementById('designer-container');
    if (!container) return;
    const r = container.getBoundingClientRect();
    const w = Math.max(0, Math.floor(r.width));
    const h = Math.max(0, Math.floor(r.height || container.clientHeight || 0));
    if (h < 200) container.style.minHeight = '70vh';

    this.stage.width(w);
    this.stage.height(h);
    this.stage.batchDraw();
  };

  // ===== Eventos Stage =====
  private attachStageEvents() {
    const stage = this.stage;

    // Zoom
    stage.on('wheel', (e) => {
      e.evt.preventDefault();
      const oldScale = stage.scaleX();
      const pointer = stage.getPointerPosition();
      if (!pointer) return;

      const scaleBy = 1.1;
      const direction = e.evt.deltaY > 0 ? -1 : 1;
      let newScale = direction > 0 ? oldScale * scaleBy : oldScale / scaleBy;
      newScale = Math.max(this.minScale, Math.min(this.maxScale, newScale));

      const mousePointTo = {
        x: (pointer.x - stage.x()) / oldScale,
        y: (pointer.y - stage.y()) / oldScale,
      };
      stage.scale({ x: newScale, y: newScale });
      stage.position({
        x: pointer.x - mousePointTo.x * newScale,
        y: pointer.y - mousePointTo.y * newScale,
      });
      stage.batchDraw();
    });

    // Pan
    stage.on('mousedown', (e) => {
      const isMiddle = (e.evt as MouseEvent)?.button === 1;
      const target = e.target as Konva.Node;

      if (isMiddle || this.spacePressed()) {
        this.isPanning.set(true);
        stage.draggable(true);
        stage.startDrag();
        return;
      }
      if (this.isTransformerTarget(target)) return;
      this.onPointerDown(e as any);
    });

    stage.on('mouseup', () => {
      this.isPanning.set(false);
      stage.draggable(false);
    });

    stage.on('mousemove', (e) => this.onPointerMove(e as any));
    stage.on('dblclick', () => this.finishPolygon());

    stage.on('click tap', (e) => {
      const target = e.target as Konva.Node;
      if (this.isTransformerTarget(target)) return;
      if (target === stage) {
        this.clearSelection();
      }
    });
  }

  private onKeyDown = (ev: KeyboardEvent) => {
    if (ev.code === 'Space') this.spacePressed.set(true);

    // Copy/Paste + Undo/Redo
    const mod = ev.metaKey || ev.ctrlKey;
    if (mod) {
      if (ev.key.toLowerCase() === 'c') { ev.preventDefault(); this.copySelection(); }
      if (ev.key.toLowerCase() === 'v') { ev.preventDefault(); this.pasteClipboard(); }
      if (ev.key.toLowerCase() === 'z') {
        ev.preventDefault();
        if (ev.shiftKey) this.redo(); else this.undo();
      }
      if (ev.key.toLowerCase() === 'y') { ev.preventDefault(); this.redo(); }
    }

    // Delete
    if ((ev.key === 'Delete' || ev.key === 'Backspace') && this.selectedId()) {
      this.drawLayer.findOne('#' + this.selectedId())?.destroy();
      this.detachTransformer();
      this.drawLayer.batchDraw();
      this.selectedId.set(null);
      this.pushHistory();
    }

    // Polígono
    if (this.isDrawingPoly()) {
      if (ev.key === 'Enter') this.finishPolygon();
      if (ev.key === 'Escape') this.cancelPolygon();
    }
  };

  private onKeyUp = (ev: KeyboardEvent) => {
    if (ev.code === 'Space') {
      this.spacePressed.set(false);
      this.isPanning.set(false);
      this.stage.draggable(false);
    }
  };

  // ===== Dibujo / Selección =====
  private onPointerDown(e: Konva.KonvaEventObject<MouseEvent>) {
    const pointer = this.stage.getPointerPosition();
    if (!pointer) return;

    const { x, y } = this.toCanvas(pointer);
    const target = e.target as Konva.Node;

    if (this.tool() === 'rect') {
      const node = new Konva.Rect({
        id: this.newId('rect'),
        x, y,
        width: 160, height: 100,
        fill: '#fff', stroke: '#111827', strokeWidth: 1.5,
        draggable: true,
      });
      node.setAttr('seats_kind', 'rect');
      node.setAttr('seats_title', this.ensureUniqueTitle('Rectángulo'));
      node.setAttr('seats_desc', '');
      this.wireNode(node, 'rect');
      this.addToDrawLayer(node);
      this.drawLayer.batchDraw();
      this.selectNode(node);
      this.pushHistory();
      return;
    }

    if (this.tool() === 'ellipse') {
      const node = new Konva.Ellipse({
        id: this.newId('ellipse'),
        x, y,
        radiusX: 60, radiusY: 40,
        fill: '#fff', stroke: '#111827', strokeWidth: 1.5,
        draggable: true,
      });
      node.setAttr('seats_kind', 'ellipse');
      node.setAttr('seats_title', this.ensureUniqueTitle('Elipse'));
      node.setAttr('seats_desc', '');
      this.wireNode(node, 'ellipse');
      this.addToDrawLayer(node);
      this.drawLayer.batchDraw();
      this.selectNode(node);
      this.pushHistory();
      return;
    }

    if (this.tool() === 'poly') {
      const p0 = this.firstVertex();
      if (!this.isDrawingPoly()) {
        this.isDrawingPoly.set(true);
        this.polyDraftPoints.set([x, y]);
        this.firstVertex.set({ x, y });
        this.spawnPolyDraft();
      } else {
        if (p0 && this.dist({ x, y }, p0) <= this.magnetRadius) {
          this.finishPolygon(true);
        } else {
          this.polyDraftPoints.set([...this.polyDraftPoints(), x, y]);
          this.updatePolyDraft();
        }
      }
      return;
    }

    // Selección
    if (this.tool() === 'select') {
      const n = target;
      if (this.isTransformerTarget(n)) return;
      if (n && n.getLayer() === this.drawLayer) {
        this.selectNode(n);
      } else {
        this.clearSelection();
      }
      return;
    }
  }

  private onPointerMove(_e: Konva.KonvaEventObject<MouseEvent>) {
    if (!this.isDrawingPoly()) return;
    const pointer = this.stage.getPointerPosition();
    if (!pointer) return;
    const { x, y } = this.toCanvas(pointer);

    const p0 = this.firstVertex();
    if (p0) {
      const near = this.dist({ x, y }, p0) <= this.magnetRadius;
      this.showMagnet.set(near);
    }

    const base = this.polyDraftPoints();
    const preview = [...base, x, y];
    const draft = this.uiLayer.findOne('#poly-draft') as Konva.Line;
    if (draft) {
      draft.points(preview);
      this.uiLayer.batchDraw();
    }

    this.drawMagnet();
  }

  // ===== Polígono draft & magnet =====
  private spawnPolyDraft() {
    const draft = new Konva.Line({
      id: 'poly-draft',
      points: this.polyDraftPoints(),
      stroke: '#1d4ed8',
      strokeWidth: 1.5,
      lineCap: 'round',
      lineJoin: 'round',
      dash: [6, 6],
      closed: false,
      listening: false,
    });
    this.uiLayer.add(draft);
    this.uiLayer.batchDraw();
  }

  private updatePolyDraft() {
    const draft = this.uiLayer.findOne('#poly-draft') as Konva.Line | null;
    if (draft) {
      draft.points(this.polyDraftPoints());
      this.uiLayer.batchDraw();
    }
  }

  private drawMagnet() {
    this.uiLayer.findOne('#poly-magnet')?.destroy();
    if (!this.showMagnet() || !this.firstVertex()) {
      this.uiLayer.batchDraw();
      return;
    }
    const p0 = this.firstVertex()!;
    const c = new Konva.Circle({
      id: 'poly-magnet',
      x: p0.x, y: p0.y,
      radius: this.magnetRadius,
      stroke: '#2563eb',
      dash: [4, 2],
      listening: false,
    });
    this.uiLayer.add(c);
    this.uiLayer.batchDraw();
  }

  private finishPolygon(forceSnapToStart = false) {
    if (!this.isDrawingPoly()) return;
    let pts = this.polyDraftPoints();

    if (forceSnapToStart && this.firstVertex()) {
      pts = [...pts, this.firstVertex()!.x, this.firstVertex()!.y];
    }
    if (pts.length < 6) { this.cancelPolygon(); return; }

    const poly = new Konva.Line({
      id: this.newId('poly'),
      points: pts,
      closed: true,
      fill: '#fff',
      stroke: '#111827',
      strokeWidth: 1.5,
      draggable: true,
    });
    poly.setAttr('seats_kind', 'poly');
    poly.setAttr('seats_title', this.ensureUniqueTitle('Polígono'));
    poly.setAttr('seats_desc', '');
    this.wireNode(poly, 'poly');
    this.addToDrawLayer(poly);

    this.uiLayer.findOne('#poly-draft')?.destroy();
    this.uiLayer.findOne('#poly-magnet')?.destroy();
    this.uiLayer.batchDraw();

    this.isDrawingPoly.set(false);
    this.polyDraftPoints.set([]);
    this.firstVertex.set(null);
    this.drawLayer.batchDraw();
    this.tool.set('select');
    this.selectNode(poly);
    this.pushHistory();
  }

  private cancelPolygon() {
    this.uiLayer.findOne('#poly-draft')?.destroy();
    this.uiLayer.findOne('#poly-magnet')?.destroy();
    this.uiLayer.batchDraw();
    this.isDrawingPoly.set(false);
    this.polyDraftPoints.set([]);
    this.firstVertex.set(null);
  }

  // ===== Selección & Transformer =====
  private selectNode(node: Konva.Node) {
    this.selectedId.set(node.id());
    this.attachTransformer(node);
    // cargar propiedades al panel
    this.propTitle.set(node.getAttr('seats_title') ?? '');
    this.propDesc.set(node.getAttr('seats_desc') ?? '');
    this.propInvalidMsg.set(null);
    // si cambio de figura, salgo del modo vértices
    if (!(node instanceof Konva.Line)) this.disableVertexEdit();
  }

  private clearSelection() {
    this.selectedId.set(null);
    this.detachTransformer();
    this.disableVertexEdit();
    this.propInvalidMsg.set(null);
    this.uiLayer.batchDraw();
  }

  private attachTransformer(node: Konva.Node) {
    this.detachTransformer();

    const tr = new Konva.Transformer({
      id: 'main-transformer',
      rotateEnabled: true,
      enabledAnchors: [
        'top-left','top-center','top-right',
        'middle-left','middle-right',
        'bottom-left','bottom-center','bottom-right'
      ],
      anchorSize: 8,
      borderStroke: '#3b82f6',
      anchorStroke: '#3b82f6',
      anchorFill: '#ffffff',
      boundBoxFunc: (oldBox, newBox) => {
        if (newBox.width < 10 || newBox.height < 10) return oldBox;
        return newBox;
      },
    });

    // “Hornear” scale en rect/ellipse para persistir tamaño exacto
    node.off('transform.resizefix');
    node.on('transform.resizefix', () => {
      if (node instanceof Konva.Rect) {
        const w = node.width() * node.scaleX();
        const h = node.height() * node.scaleY();
        node.width(w); node.height(h); node.scale({ x: 1, y: 1 });
      } else if (node instanceof Konva.Ellipse) {
        const rx = node.radiusX() * node.scaleX();
        const ry = node.radiusY() * node.scaleY();
        node.radiusX(rx); node.radiusY(ry); node.scale({ x: 1, y: 1 });
      }
      // poly: dejamos transform sin “hornear” (solo para edición de vértices lo horneamos)
    });

    node.off('transformend.resizefix');
    node.on('transformend.resizefix', () => {
      this.drawLayer.batchDraw();
      this.uiLayer.batchDraw();
      this.pushHistory();
    });

    node.off('dragend.history');
    node.on('dragend.history', () => {
      this.drawLayer.batchDraw();
      this.pushHistory();
    });

    this.uiLayer.add(tr);
    tr.nodes([node as any]);
    this.uiLayer.batchDraw();
  }

  private detachTransformer() {
    this.uiLayer.find('#main-transformer').forEach(n => n.destroy());
  }

  private addCommonHandlers(node: Konva.Node & { id(): string }) {
    node.on('click tap', (e) => {
      e.cancelBubble = true;
      this.selectNode(node);
    });
  }

  private wireNode(node: Konva.Node, kind: ShapeKind) {
    this.addCommonHandlers(node);
    (node as any).draggable(true);
    node.on('mouseenter', () => this.stage.container().style.cursor = 'move');
    node.on('mouseleave', () => this.stage.container().style.cursor = 'default');
    (node as any).setAttr('seats_kind', kind);
  }

  private isTransformerTarget(node: Konva.Node | null | undefined): boolean {
    if (!node) return false;
    if ((node as any).getClassName?.() === 'Transformer') return true;
    let p: Konva.Node | null = node;
    while (p) {
      if ((p as any).getClassName?.() === 'Transformer') return true;
      p = p.getParent();
    }
    return false;
  }

  // ===== Clipboard =====
  private copySelection() {
    const id = this.selectedId();
    if (!id) return;
    const node = this.drawLayer.findOne('#' + id);
    if (!node) return;
    this.clipboardJSON = [node.toJSON()];
  }

  private pasteClipboard() {
    if (!this.clipboardJSON?.length) return;
    const newNodes: Konva.Node[] = [];
    for (const json of this.clipboardJSON) {
      const clone = Konva.Node.create(json) as Konva.Node;
      clone.id(this.reid(clone.id()));
      // título único con sufijo
      const t = clone.getAttr('seats_title') ?? '';
      clone.setAttr('seats_title', this.ensureUniqueTitle(t));
      // mover un poco
      const cx = (clone as any).x?.() ?? 0;
      const cy = (clone as any).y?.() ?? 0;
      (clone as any).x?.(cx + 12);
      (clone as any).y?.(cy + 12);

      const kind = (clone.getAttr('seats_kind') as ShapeKind) ||
                   (clone instanceof Konva.Rect ? 'rect' :
                    clone instanceof Konva.Ellipse ? 'ellipse' : 'poly');
      this.wireNode(clone, kind);
      this.addToDrawLayer(clone);
      newNodes.push(clone);
    }
    this.drawLayer.batchDraw();
    if (newNodes.length) this.selectNode(newNodes[newNodes.length - 1]);
    this.pushHistory();
  }

  private reid(oldId: string) {
    const base = oldId.replace(/_\w{4,8}$/, '');
    return `${base}_${Math.random().toString(36).slice(2, 8)}`;
  }

  // ===== History (undo/redo) =====
  private pushHistory() {
    if (this.suppressHistory) return;
    const children = this.drawLayer.getChildren();
    const snapshot = children.map(n => n.toJSON());
    this.undoStack.push(snapshot);
    this.redoStack = [];
  }

  private restoreHistory(snapshot: string[]) {
    this.suppressHistory = true;
    try {
      this.detachTransformer();
      this.disableVertexEdit();
      this.drawLayer.destroyChildren();

      for (const json of snapshot) {
        const node = Konva.Node.create(json) as Konva.Node;
        let kind: ShapeKind | undefined = node.getAttr('seats_kind');
        if (!kind) {
          if (node instanceof Konva.Rect) kind = 'rect';
          else if (node instanceof Konva.Ellipse) kind = 'ellipse';
          else if (node instanceof Konva.Line) kind = 'poly';
          else kind = 'rect';
        }
        this.wireNode(node, kind);
        this.addToDrawLayer(node);
      }
      this.drawLayer.batchDraw();
      this.selectedId.set(null);
    } finally {
      this.suppressHistory = false;
    }
  }

  undo() {
    if (this.undoStack.length <= 1) return;
    const current = this.undoStack.pop()!;
    const prev = this.undoStack[this.undoStack.length - 1];
    this.redoStack.push(current);
    this.restoreHistory(prev);
  }

  redo() {
    if (!this.redoStack.length) return;
    const next = this.redoStack.pop()!;
    const current = this.drawLayer.getChildren().map(n => n.toJSON());
    this.undoStack.push(current);
    this.restoreHistory(next);
  }

  // ===== Properties panel =====
  updatePropTitle(raw: string) {
    const node = this.getSelectedNode();
    if (!node) return;
    const unique = this.ensureUniqueTitle(raw, node.id());
    if (unique !== raw) {
      this.propInvalidMsg.set(`Ya existe: renombrado a “${unique}”`);
    } else {
      this.propInvalidMsg.set(null);
    }
    node.setAttr('seats_title', unique);
    this.propTitle.set(unique);
    this.pushHistory();
  }

  updatePropDesc(raw: string) {
    const node = this.getSelectedNode();
    if (!node) return;
    node.setAttr('seats_desc', raw ?? '');
    this.propDesc.set(raw ?? '');
    this.pushHistory();
  }

  private getSelectedNode(): Konva.Node | null {
    const id = this.selectedId();
    if (!id) return null;
    return this.drawLayer.findOne('#' + id) as Konva.Node | null;
  }

  private ensureUniqueTitle(base: string, excludeId?: string): string {
    const name = (base ?? '').trim() || 'Sin título';
    const titles = new Set<string>();
    this.drawLayer.getChildren().forEach(n => {
      if (excludeId && n.id() === excludeId) return;
      const t = (n.getAttr('seats_title') ?? '').toString();
      if (t) titles.add(t);
    });
    if (!titles.has(name)) return name;
    for (let i = 2; i < 1000; i++) {
      const candidate = `${name} (${i})`;
      if (!titles.has(candidate)) return candidate;
    }
    return `${name} (${Math.random().toString(36).slice(2,4)})`;
  }

  // ===== Vertex edit for polygons =====
  toggleVertexEdit() {
    const node = this.getSelectedNode();
    if (!node || !(node instanceof Konva.Line)) return;
    if (this.editingVertices()) {
      this.disableVertexEdit();
    } else {
      this.enableVertexEdit(node);
    }
  }

  private enableVertexEdit(line: Konva.Line) {
    // hornea transform → puntos absolutos
    this.bakePolyTransform(line);
    // anchors por vértice
    this.buildPolyAnchors(line);
    this.editingVertices.set(true);
  }

  private disableVertexEdit() {
    this.uiLayer.find('.vertex-anchor').forEach(n => n.destroy());
    this.uiLayer.batchDraw();
    this.editingVertices.set(false);
  }

  private bakePolyTransform(line: Konva.Line) {
    const abs = line.getAbsoluteTransform().copy();
    const pts = line.points();
    const baked: number[] = [];
    for (let i = 0; i < pts.length; i += 2) {
      const p = abs.point({ x: pts[i], y: pts[i + 1] });
      baked.push(p.x, p.y);
    }
    line.position({ x: 0, y: 0 });
    line.rotation(0);
    line.scale({ x: 1, y: 1 });
    line.points(baked);
    this.drawLayer.batchDraw();
  }

  private buildPolyAnchors(line: Konva.Line) {
    this.uiLayer.find('.vertex-anchor').forEach(n => n.destroy());
    const pts = line.points();
    for (let i = 0; i < pts.length; i += 2) {
      const ax = pts[i], ay = pts[i + 1];
      const anchor = new Konva.Circle({
        x: ax, y: ay, radius: 6,
        fill: '#ffffff', stroke: '#2563eb', strokeWidth: 2,
        draggable: true, id: `v-${i / 2}`, name: 'vertex-anchor',
      });
      anchor.on('dragmove', () => {
        const idx = Number(anchor.id().split('-')[1]);
        const p = line.points();
        p[idx * 2] = anchor.x();
        p[idx * 2 + 1] = anchor.y();
        line.points(p);
        this.drawLayer.batchDraw();
        this.uiLayer.batchDraw();
      });
      anchor.on('dragend', () => {
        this.pushHistory();
      });
      this.uiLayer.add(anchor);
    }
    this.uiLayer.batchDraw();
  }

  // ===== Utils =====
  private dist(a: {x:number;y:number}, b:{x:number;y:number}) {
    const dx = a.x - b.x, dy = a.y - b.y;
    return Math.hypot(dx, dy);
  }

  private newId(prefix: string) {
    return `${prefix}_${Math.random().toString(36).slice(2, 8)}`;
  }

  private toCanvas(p: { x: number; y: number }) {
    const s = this.stage.scaleX();
    return { x: (p.x - this.stage.x()) / s, y: (p.y - this.stage.y()) / s };
  }

  // Add Konva.Node to layer with safe narrowing (evita TS2345)
  private addToDrawLayer(n: Konva.Node) {
    if (n instanceof Konva.Rect || n instanceof Konva.Ellipse || n instanceof Konva.Line || n instanceof Konva.Group) {
      this.drawLayer.add(n);
      return;
    }
    this.drawLayer.add(n as unknown as Konva.Shape);
  }

  // ===== Toolbar =====
  setTool(t: Tool) {
    if (this.isDrawingPoly() && t !== 'poly') this.cancelPolygon();
    this.tool.set(t);
    if (t !== 'select') this.clearSelection();
  }

  deleteSelected() {
    const id = this.selectedId();
    if (!id) return;
    this.drawLayer.findOne('#' + id)?.destroy();
    this.detachTransformer();
    this.disableVertexEdit();
    this.selectedId.set(null);
    this.drawLayer.batchDraw();
    this.pushHistory();
  }

  zoomFit() {
    this.stage.scale({ x: 1, y: 1 });
    this.stage.position({ x: 0, y: 0 });
    this.stage.batchDraw();
  }
}
