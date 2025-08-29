import {
  Component, ViewChild, signal, effect, OnDestroy, AfterViewInit, inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import Konva from 'konva';
import { NgxKonvaModule, KoStageComponent, KoLayerComponent } from 'ngx-konva';
import { DJANGO_CONFIG, DjangoConfig } from '../main';

type Tool = 'select' | 'rect' | 'ellipse' | 'poly';
type Pt = { x: number; y: number };

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, FormsModule, NgxKonvaModule],
  templateUrl: './app.html',
  styleUrls: ['./app.scss'],
})
export class App implements AfterViewInit, OnDestroy {
  // ===== Inyección / estado base
  cfg: DjangoConfig = inject(DJANGO_CONFIG);
  // protected readonly title = signal('designer');

  // Konva refs
  @ViewChild('stageRef',     { static: true }) stageRef!: KoStageComponent;
  @ViewChild('drawLayerRef', { static: true }) drawLayerRef!: KoLayerComponent;
  @ViewChild('uiLayerRef',   { static: true }) uiLayerRef!: KoLayerComponent;

  // Stage
  stageConfig = { width: 1200, height: 800, draggable: false };
  minScale = 0.2; maxScale = 4;

  // UI
  tool = signal<Tool>('select');
  isPanning = signal(false);
  spacePressed = signal(false);
  selectedId = signal<string | null>(null);
  bgColor = signal<string>('#f5f7fb');

  // Mensajes
  sideMsg = signal<string | null>(null);

  // Preview fila (opt-in)
  rowPreviewEnabled = signal(false);
  private previewRowY = signal<number | null>(null);

  // Polígono (boceto)
  isDrawingPoly = signal(false);
  polyPts = signal<number[]>([]);
  firstVertex = signal<Pt | null>(null);
  magnetRadius = 10;
  showMagnet = signal(false);

  // Historial
  private undoStack: string[][] = [];
  private redoStack: string[][] = [];
  private suppressHistory = false;
  private clipboardJSON: string[] | null = null;

  // Propiedades
  propTitle = signal(''); propDesc = signal('');
  propInvalidMsg = signal<string | null>(null);

  rowName = signal('');
  rowSeats = signal(10);
  rowTicket = signal('General');
  rowSeatRadius = signal(12);
  rowHeight = signal(28);
  rowSpacing = signal(6);

  // Layout
  private readonly SNAP_Y = 2;

  private ro?: ResizeObserver;
  private fitTimer?: any;
  private _noopEffect = effect(() => void 0);

  // Helpers template
  get userName(): string { return (this.cfg as any)?.user?.name ?? 'anónimo'; }
  isSectorSelected(): boolean { const n = this.getSelectedNode(); return !!n && n.getAttr('seats_kind') === 'sector'; }
  isRowSelected(): boolean    { const n = this.getSelectedNode(); return !!n && n.getAttr('seats_kind') === 'row'; }

  // Acceso seguro
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

  // ===== Ciclo de vida
  ngAfterViewInit() {
    setTimeout(() => {
      this.fitStageToContainer();
      this.attachStageEvents();
      this.stage.batchDraw();
      this.pushHistory();
    }, 0);

    const container = document.getElementById('designer-container');
    if (container) {
      this.ro = new ResizeObserver(() => {
        clearTimeout(this.fitTimer);
        this.fitTimer = setTimeout(() => this.fitStageToContainer(), 40);
      });
      this.ro.observe(container);
    }

    window.addEventListener('keydown', this.onKeyDown, true);
    window.addEventListener('keyup', this.onKeyUp, true);
  }
  ngOnDestroy() {
    this.ro?.disconnect();
    window.removeEventListener('keydown', this.onKeyDown, true);
    window.removeEventListener('keyup', this.onKeyUp, true);
  }

  // ===== Layout
  private fitStageToContainer = () => {
    const container = document.getElementById('designer-container');
    if (!container) return;
    const r = container.getBoundingClientRect();
    const w = Math.max(0, Math.floor(r.width));
    const h = Math.max(0, Math.floor(r.height || container.clientHeight || 0));
    if (h < 200) container.style.minHeight = '70vh';
    this.stage.width(w); this.stage.height(h); this.stage.batchDraw();
  };

  // ===== Eventos stage
  private attachStageEvents() {
    const stage = this.stage;

    // Zoom
    stage.on('wheel', (e) => {
      e.evt.preventDefault();
      const old = stage.scaleX();
      const ptr = stage.getPointerPosition(); if (!ptr) return;
      const by = 1.1; const dir = e.evt.deltaY > 0 ? -1 : 1;
      let ns = dir > 0 ? old * by : old / by;
      ns = Math.max(this.minScale, Math.min(this.maxScale, ns));
      const m = { x: (ptr.x - stage.x()) / old, y: (ptr.y - stage.y()) / old };
      stage.scale({ x: ns, y: ns });
      stage.position({ x: ptr.x - m.x * ns, y: ptr.y - m.y * ns });
      stage.batchDraw();
    });

    // Pan y clicks
    stage.on('mousedown', (e) => {
      const isMid = (e.evt as MouseEvent).button === 1;
      const tgt = e.target as Konva.Node;
      if (isMid || this.spacePressed()) {
        this.isPanning.set(true);
        stage.draggable(true);
        stage.startDrag();
        return;
      }
      if (this.isTransformerTarget(tgt)) return;
      this.onPointerDown(e as any);
    });
    stage.on('mouseup', () => { this.isPanning.set(false); stage.draggable(false); });
    stage.on('mousemove', (e) => this.onPointerMove(e as any));
    stage.on('dblclick', () => this.finishPolygon());

    stage.on('click tap', (e) => {
      const tgt = e.target as Konva.Node;
      if (this.isTransformerTarget(tgt)) return;
      if (tgt === stage) this.clearSelection();
    });
  }

  // ===== Teclado
  private isTypingInInput(ev: KeyboardEvent): boolean {
    const ae = (document.activeElement as HTMLElement | null);
    const t = (ev.target as HTMLElement | null) ?? ae;
    if (!t) return false;
    const tag = t.tagName?.toUpperCase();
    const editable = (t as any).isContentEditable;
    return editable || tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
  }
  private onKeyDown = (ev: KeyboardEvent) => {
    if (this.isTypingInInput(ev)) return;

    if (ev.code === 'Space') this.spacePressed.set(true);

    const mod = ev.metaKey || ev.ctrlKey;
    if (mod) {
      if (ev.key.toLowerCase() === 'c') { ev.preventDefault(); this.copySelection(); }
      if (ev.key.toLowerCase() === 'v') { ev.preventDefault(); this.pasteClipboard(); }
      if (ev.key.toLowerCase() === 'z') { ev.preventDefault(); ev.shiftKey ? this.redo() : this.undo(); }
      if (ev.key.toLowerCase() === 'y') { ev.preventDefault(); this.redo(); }
    }

    if ((ev.key === 'Delete' || ev.key === 'Backspace') && this.selectedId()) {
      ev.preventDefault();
      this.drawLayer.findOne('#' + this.selectedId())?.destroy();
      this.detachTransformer(); this.drawLayer.batchDraw();
      this.selectedId.set(null); this.pushHistory();
    }

    if (this.isDrawingPoly()) {
      if (ev.key === 'Enter') this.finishPolygon();
      if (ev.key === 'Escape') this.cancelPolygon();
    }
  };
  private onKeyUp = () => {
    if (this.spacePressed()) { this.spacePressed.set(false); this.isPanning.set(false); this.stage.draggable(false); }
  };

  // ===== Dibujo / selección
  private onPointerDown(e: Konva.KonvaEventObject<MouseEvent>) {
    const ptr = this.stage.getPointerPosition(); if (!ptr) return;
    const { x, y } = this.toCanvas(ptr);
    const tgt = e.target as Konva.Node;

    if (this.tool() === 'rect')   { const g = this.createSectorRect(x, y, 220, 140); this.addToDrawLayer(g); this.selectNode(g); this.pushHistory(); return; }
    if (this.tool() === 'ellipse'){ const g = this.createSectorEllipse(x, y, 110, 70); this.addToDrawLayer(g); this.selectNode(g); this.pushHistory(); return; }
    if (this.tool() === 'poly') {
      if (!this.isDrawingPoly()) { this.isDrawingPoly.set(true); this.polyPts.set([x,y]); this.firstVertex.set({x,y}); this.spawnPolyDraft(); }
      else {
        const p0 = this.firstVertex();
        if (p0 && this.dist({x,y}, p0) <= this.magnetRadius) this.finishPolygon(true);
        else { this.polyPts.set([...this.polyPts(), x, y]); this.updatePolyDraft(); }
      }
      return;
    }

    // Selección
    if (this.tool() === 'select') {
      const n = tgt;
      if (this.isTransformerTarget(n)) return;
      if (n && n.getLayer() === this.drawLayer) this.selectNode(n); else this.clearSelection();
    }
  }
  private onPointerMove(_e: Konva.KonvaEventObject<MouseEvent>) {
    if (!this.rowPreviewEnabled()) return;
    const sector = this.getSelectedNode();
    if (!sector || sector.getAttr('seats_kind') !== 'sector') return;

    const g = sector as Konva.Group;
    const local = g.getRelativePointerPosition(); if (!local) return;
    this.previewRowY.set(local.y - this.rowHeight()/2);
    this.renderRowPreview();
  }

  // ===== Polígono (draft)
  private spawnPolyDraft() {
    const draft = new Konva.Line({ id:'poly-draft', points:this.polyPts(), stroke:'#1d4ed8', strokeWidth:1.5, dash:[6,6], closed:false, listening:false, lineJoin:'round', lineCap:'round' });
    this.uiLayer.add(draft); this.uiLayer.batchDraw();
  }
  private updatePolyDraft() { const d = this.uiLayer.findOne('#poly-draft') as Konva.Line | null; if (d) { d.points(this.polyPts()); this.uiLayer.batchDraw(); } }
  private drawMagnet() {
    this.uiLayer.findOne('#poly-magnet')?.destroy();
    if (!this.showMagnet() || !this.firstVertex()) { this.uiLayer.batchDraw(); return; }
    const p0 = this.firstVertex()!;
    const c = new Konva.Circle({ id:'poly-magnet', x:p0.x, y:p0.y, radius:this.magnetRadius, stroke:'#2563eb', dash:[4,2], listening:false });
    this.uiLayer.add(c); this.uiLayer.batchDraw();
  }
  private finishPolygon(forceSnap=false) {
    if (!this.isDrawingPoly()) return;
    let pts = this.polyPts();
    if (forceSnap && this.firstVertex()) pts = [...pts, this.firstVertex()!.x, this.firstVertex()!.y];
    if (pts.length < 6) { this.cancelPolygon(); return; }
    const xs = pts.filter((_,i)=> i%2===0), ys = pts.filter((_,i)=> i%2===1);
    const minX = Math.min(...xs), minY = Math.min(...ys);
    const norm = pts.map((v,i)=> i%2===0 ? v-minX : v-minY);
    const g = this.createSectorPoly(minX, minY, norm);
    this.addToDrawLayer(g);
    this.uiLayer.findOne('#poly-draft')?.destroy();
    this.uiLayer.findOne('#poly-magnet')?.destroy();
    this.uiLayer.batchDraw();
    this.isDrawingPoly.set(false); this.polyPts.set([]); this.firstVertex.set(null);
    this.drawLayer.batchDraw(); this.tool.set('select'); this.selectNode(g); this.pushHistory();
  }
  private cancelPolygon() {
    this.uiLayer.findOne('#poly-draft')?.destroy();
    this.uiLayer.findOne('#poly-magnet')?.destroy();
    this.uiLayer.batchDraw();
    this.isDrawingPoly.set(false); this.polyPts.set([]); this.firstVertex.set(null);
  }

  // ===== Contenedor de filas + clip
  private getRowsContainer(sector: Konva.Group, createIfMissing=true): Konva.Group | null {
    let rows = sector.findOne<Konva.Group>('#rows-container');
    if (!rows && createIfMissing) { rows = new Konva.Group({ id:'rows-container' }); sector.add(rows); }
    return rows || null;
  }
  private updateRowsClip(sector: Konva.Group) {
    const shapeKind = String(sector.getAttr('sector_shape'));
    const bounds = (sector.getAttr('bounds') || { width:200, height:120 }) as { width:number; height:number };
    const rows = this.getRowsContainer(sector); if (!rows) return;

    if (shapeKind === 'rect') {
      rows.clip({ x:0, y:0, width: bounds.width, height: bounds.height });
      rows.clipFunc(undefined as any);
    } else if (shapeKind === 'ellipse') {
      rows.clipFunc((ctx) => {
        const rx = bounds.width/2, ry = bounds.height/2;
        ctx.beginPath(); ctx.ellipse(rx, ry, rx, ry, 0, 0, Math.PI*2); ctx.closePath();
      });
    } else {
      const pts: number[] = sector.getAttr('points') || [];
      rows.clipFunc((ctx) => {
        if (!pts.length) { ctx.rect(0,0,bounds.width,bounds.height); return; }
        ctx.beginPath(); ctx.moveTo(pts[0], pts[1]);
        for (let i=2;i<pts.length;i+=2) ctx.lineTo(pts[i], pts[i+1]);
        ctx.closePath();
      });
    }
  }

  // ===== Crear sectores
  private createSectorRect(x:number,y:number,w:number,h:number): Konva.Group {
    const g = new Konva.Group({ id:this.newId('sector'), x, y, draggable:true });
    const shape = new Konva.Rect({ x:0,y:0,width:w,height:h, fill:'#fff', stroke:'#111827', strokeWidth:1.5, name:'sector-shape' });
    g.add(shape);
    g.setAttr('seats_kind','sector'); g.setAttr('sector_shape','rect');
    g.setAttr('bounds',{ width:w, height:h });
    g.setAttr('seats_title', this.ensureUniqueTitle('Sector')); g.setAttr('seats_desc','');
    this.getRowsContainer(g, true); this.updateRowsClip(g);
    this.wireSector(g);
    return g;
  }
  private createSectorEllipse(x:number,y:number,rx:number,ry:number): Konva.Group {
    const g = new Konva.Group({ id:this.newId('sector'), x, y, draggable:true });
    const shape = new Konva.Ellipse({ x:rx,y:ry,radiusX:rx,radiusY:ry, fill:'#fff', stroke:'#111827', strokeWidth:1.5, name:'sector-shape' });
    g.add(shape);
    g.setAttr('seats_kind','sector'); g.setAttr('sector_shape','ellipse');
    g.setAttr('bounds',{ width:rx*2, height:ry*2 });
    g.setAttr('seats_title', this.ensureUniqueTitle('Sector')); g.setAttr('seats_desc','');
    this.getRowsContainer(g, true); this.updateRowsClip(g);
    this.wireSector(g);
    return g;
  }
  private createSectorPoly(x:number,y:number,points:number[]): Konva.Group {
    const g = new Konva.Group({ id:this.newId('sector'), x, y, draggable:true });
    const shape = new Konva.Line({ points, closed:true, fill:'#fff', stroke:'#111827', strokeWidth:1.5, name:'sector-shape' });
    g.add(shape);
    const br = shape.getClientRect({ relativeTo: g });
    g.setAttr('seats_kind','sector'); g.setAttr('sector_shape','poly');
    g.setAttr('points', points.slice());
    g.setAttr('bounds',{ width: br.width, height: br.height });
    g.setAttr('seats_title', this.ensureUniqueTitle('Sector')); g.setAttr('seats_desc','');
    this.getRowsContainer(g, true); this.updateRowsClip(g);
    this.wireSector(g);
    return g;
  }
  private wireSector(g: Konva.Group) {
    g.on('click tap', (e) => { e.cancelBubble = true; this.selectNode(g as unknown as Konva.Node); });
    g.on('dragend.history', () => this.pushHistory());
    (g as any).setAttr('seats_kind','sector');
  }

  // ===== Agregar fila (NO toca otras filas)
  addRowToSelectedSector() {
    this.sideMsg.set(null);

    const sec = this.getSelectedNode();
    if (!sec || sec.getAttr('seats_kind') !== 'sector') return;
    const g = sec as Konva.Group;
    const bounds = (g.getAttr('bounds') || { width:200, height:120 }) as { width:number; height:number };

    const desired = this.rowPreviewEnabled() && typeof this.previewRowY() === 'number'
      ? Math.max(0, Math.min(this.previewRowY()!, bounds.height - this.rowHeight()))
      : null;

    const spacing = Math.max(0, Number(this.rowSpacing()));
    const freeY = desired !== null
      ? this.tryPlaceAt(g, desired, this.rowHeight(), spacing)
      : this.firstFreeSlotY(g, this.rowHeight(), spacing);

    if (freeY === null) {
      this.sideMsg.set('No hay espacio disponible en este sector para otra fila.');
      return;
    }

    const nameBase = (this.rowName().trim()) || this.nextRowLetter(g);
    const rowName = this.ensureUniqueRowName(g, nameBase);

    const row = this.buildRow(g, {
      name: rowName,
      seats: Number(this.rowSeats()),
      ticket: this.rowTicket(),
      seatRadius: Number(this.rowSeatRadius()),
      height: Number(this.rowHeight()),
      y: freeY,
      leftPad: 12, rightPad: 12, labelOffset: 8
    });

    this.getRowsContainer(g, true)!.add(row);
    // Refrescamos SOLO la fila nueva (no tocamos las existentes)
    this.refreshRowVisual(row, g);

    this.drawLayer.batchDraw();
    this.pushHistory();
  }

  private tryPlaceAt(sector: Konva.Group, y0: number, rowH: number, spacing: number): number | null {
    const rows = this.getRows(sector);
    const bounds = (sector.getAttr('bounds') || { width:200, height:120 }) as { width:number; height:number };
    let y = Math.round(Math.max(0, Math.min(y0, bounds.height - rowH)) / this.SNAP_Y) * this.SNAP_Y;

    const ok = !rows.some(r => {
      const ry = r.y(), rh = Number(r.getAttr('row_height') ?? 28);
      const a1 = y, a2 = y + rowH;
      const b1 = ry, b2 = ry + rh;
      return !(a2 + spacing <= b1 || b2 + spacing <= a1);
    });

    return ok ? y : null;
  }

  private firstFreeSlotY(sector: Konva.Group, rowH: number, spacing: number): number | null {
    const bounds = (sector.getAttr('bounds') || { width:200, height:120 }) as { width:number; height:number };
    const rows = this.getRows(sector).sort((a,b)=> a.y()-b.y());

    let cursor = 0;
    for (const r of rows) {
      const gap = r.y() - cursor;
      if (gap >= rowH) return Math.round(cursor / this.SNAP_Y) * this.SNAP_Y;
      cursor = r.y() + Number(r.getAttr('row_height') ?? 28) + spacing;
    }
    if (bounds.height - cursor >= rowH) return Math.round(cursor / this.SNAP_Y) * this.SNAP_Y;
    return null;
  }

  // ===== Refrescar SOLO una fila (visual y seats)
  private refreshRowVisual(row: Konva.Group, sector: Konva.Group) {
    const bounds = (sector.getAttr('bounds') || { width:200, height:120 }) as { width:number; height:number };
    const w = bounds.width;

    const h = Number(row.getAttr('row_height') ?? 28);
    const name = String(row.getAttr('row_name') ?? '');
    const seats = Number(row.getAttr('seats') ?? 10);
    const rAttr = Number(row.getAttr('seat_radius') ?? 12);
    const ticket = String(row.getAttr('ticket') ?? 'General');

    // Banda
    const band = row.findOne<Konva.Rect>('.row-band'); if (band) { band.width(w); band.height(h); }

    // Label
    const label = row.findOne<Konva.Text>('.row-label');
    if (label) {
      label.text(name);
      label.y(h/2 - 8);
      label.x(-label.width() - 8);
    }

    // Hit
    const hit = row.findOne<Konva.Rect>('.row-hit');
    if (hit && label) {
      hit.x(-label.width() - 16);
      hit.width(w + label.width() + 16);
      hit.height(h);
    }

    // Seats
    const seatsGroup = row.findOne<Konva.Group>('.seats');
    if (seatsGroup) {
      const leftPad = 12, rightPad = 12;
      const usable = Math.max(0, w - leftPad - rightPad);

      // Limitar radio SOLO si no cabe horizontalmente (no tocamos otras filas)
      const maxR = seats > 0 ? Math.floor(usable / (2 * seats)) : rAttr;
      const rEff = Math.max(2, Math.min(rAttr, maxR));

      this.populateSeats(seatsGroup, {
        seats, radius:rEff, leftPad, rightPad, width:w, centerY:h/2, ticket
      });
    }
  }

  // ===== Editar fila desde panel (NO mueve otras)
  applyRowEditsFromPanel() {
    const n = this.getSelectedNode(); if (!n || n.getAttr('seats_kind') !== 'row') return;
    const row = n as Konva.Group;
    const sector = (row.getParent()?.getParent() as Konva.Group) ?? (row.getParent() as Konva.Group);

    row.setAttr('row_name', this.rowName());
    row.setAttr('ticket', this.rowTicket());
    row.setAttr('seats', Number(this.rowSeats()));
    row.setAttr('seat_radius', Number(this.rowSeatRadius()));
    row.setAttr('row_height', Number(this.rowHeight()));

    this.refreshRowVisual(row, sector);
    this.drawLayer.batchDraw(); this.pushHistory();
  }

  // ===== Construir fila
  private buildRow(sector: Konva.Group, opt: {
    name:string; seats:number; ticket:string; seatRadius:number; height:number; y:number;
    leftPad:number; rightPad:number; labelOffset:number;
  }): Konva.Group {
    const bounds = (sector.getAttr('bounds') || { width:200, height:120 }) as { width:number; height:number };
    const w = bounds.width;

    const row = new Konva.Group({ id: this.newId('row'), x:0, y:opt.y, draggable:true });
    row.setAttr('seats_kind','row');
    row.setAttr('row_name', opt.name);
    row.setAttr('ticket', opt.ticket);
    row.setAttr('seats', opt.seats);
    row.setAttr('seat_radius', opt.seatRadius);
    row.setAttr('row_height', opt.height);

    const band = new Konva.Rect({ name:'row-band', x:0, y:0, width:w, height:opt.height, fill:'#00000008', stroke:'#e5e7eb', strokeWidth:1 });
    band.hitStrokeWidth(20); row.add(band);

    const label = new Konva.Text({ name:'row-label', text: opt.name, fontSize:12, fill:'#374151', x:-opt.labelOffset, y: opt.height/2 - 8, align:'right' });
    row.add(label); label.x(-label.width() - opt.labelOffset);

    const hit = new Konva.Rect({ name:'row-hit', x: -label.width() - opt.labelOffset - 8, y: 0, width: w + label.width() + opt.labelOffset + 8, height: opt.height, opacity: 0, listening: true });
    row.add(hit);

    const seatsGroup = new Konva.Group({ name:'seats' }); row.add(seatsGroup);
    this.populateSeats(seatsGroup, { seats: opt.seats, radius: opt.seatRadius, leftPad: opt.leftPad, rightPad: opt.rightPad, width: w, centerY: opt.height/2, ticket: opt.ticket });

    const selectSelf = (e?: any) => { if (e) e.cancelBubble = true; this.selectNode(row as unknown as Konva.Node); };
    row.on('click tap', selectSelf); band.on('click tap', selectSelf); label.on('click tap', selectSelf); hit.on('click tap', selectSelf);

    // Limitar drag a los bounds del sector, sin afectar otras filas
    row.on('dragmove', () => {
      const sectorGroup = (row.getParent()?.getParent() as Konva.Group) ?? (row.getParent() as Konva.Group);
      const b = (sectorGroup.getAttr('bounds') || { width:200, height:120 }) as { width:number; height:number };
      let y = Math.max(0, Math.min(row.y(), b.height - Number(row.getAttr('row_height') ?? 28)));
      y = Math.round(y / this.SNAP_Y) * this.SNAP_Y;
      row.y(y);
    });
    row.on('dragend.history', () => {
      const sectorGroup = (row.getParent()?.getParent() as Konva.Group) ?? (row.getParent() as Konva.Group);
      this.refreshRowVisual(row, sectorGroup);
      this.pushHistory();
    });

    return row;
  }

  private populateSeats(target: Konva.Group, opt: {
    seats:number; radius:number; leftPad:number; rightPad:number; width:number; centerY:number; ticket:string;
  }) {
    target.destroyChildren();

    const N = Math.max(1, opt.seats | 0);
    const usable = Math.max(0, opt.width - opt.leftPad - opt.rightPad);

    const rEff = Math.max(2, Math.min(opt.radius, N > 0 ? Math.floor(usable / (2 * N)) : opt.radius));
    const start = opt.leftPad + rEff;
    const end   = opt.width - opt.rightPad - rEff;
    const span  = Math.max(0, end - start);
    const step  = N > 1 ? span / (N - 1) : 0;

    for (let i=0;i<N;i++) {
      const cx = N > 1 ? start + i * step : opt.width / 2;
      const seat = new Konva.Circle({ x: cx, y: opt.centerY, radius: rEff, fill:'#fff', stroke:'#111827', strokeWidth:1 });
      seat.setAttr('seats_kind','seat'); seat.setAttr('ticket', opt.ticket); seat.setAttr('seat_index', i+1);
      seat.on('click tap', (e)=>{ e.cancelBubble = true; this.selectNode(seat as unknown as Konva.Node); });
      target.add(seat);
    }
  }

  private getRows(sector: Konva.Group): Konva.Group[] {
    const rowsContainer = this.getRowsContainer(sector, false);
    if (!rowsContainer) return [];
    return rowsContainer.getChildren((n)=> (n as any).getAttr?.('seats_kind') === 'row') as Konva.Group[];
  }

  // ===== Propiedades
  updatePropTitle(raw: string) {
    const n = this.getSelectedNode(); if (!n) return;

    if (n.getAttr('seats_kind') === 'sector') {
      const unique = this.ensureUniqueTitle(raw, n.id());
      if (unique !== raw) this.propInvalidMsg.set(`Ya existe: renombrado a “${unique}”`); else this.propInvalidMsg.set(null);
      n.setAttr('seats_title', unique); this.propTitle.set(unique); this.pushHistory(); return;
    }

    if (n.getAttr('seats_kind') === 'row') {
      const sector = (n.getParent()?.getParent() as Konva.Group) ?? (n.getParent() as Konva.Group);
      const unique = this.ensureUniqueRowName(sector, raw, n.id());
      if (unique !== raw) this.propInvalidMsg.set(`Ya existe: renombrado a “${unique}”`); else this.propInvalidMsg.set(null);
      n.setAttr('row_name', unique); this.rowName.set(unique);
      if (n instanceof Konva.Group) {
        const label = n.findOne<Konva.Text>('Text'); if (label) { label.text(unique); label.x(-label.width() - 8); }
      }
      this.drawLayer.batchDraw(); this.pushHistory(); return;
    }
  }
  updatePropDesc(raw: string) {
    const n = this.getSelectedNode(); if (!n) return;
    if (n.getAttr('seats_kind') === 'sector') {
      n.setAttr('seats_desc', raw ?? ''); this.propDesc.set(raw ?? ''); this.pushHistory();
    }
  }

  // ===== Selección
  private selectNode(node: Konva.Node) {
    let n: Konva.Node | null = node;
    const kind = node.getAttr('seats_kind');
    if (kind === 'seat') n = node.getParent()?.getParent() || node;
    if (node instanceof Konva.Shape && node.getParent()?.getAttr('seats_kind') === 'sector') n = node.getParent()!;
    node = n!;

    this.selectedId.set(node.id());
    this.attachTransformer(node);
    this.propInvalidMsg.set(null);

    // Desactivar preview al seleccionar
    this.rowPreviewEnabled.set(false);
    this.previewRowY.set(null);
    this.removeRowPreview();

    if (node.getAttr('seats_kind') === 'sector') {
      this.propTitle.set(node.getAttr('seats_title') ?? '');
      this.propDesc.set(node.getAttr('seats_desc') ?? '');
      this.rowName.set(this.nextRowLetter(node as Konva.Group));
    } else if (node.getAttr('seats_kind') === 'row') {
      this.propTitle.set(node.getAttr('row_name') ?? '');
      this.rowName.set(node.getAttr('row_name') ?? '');
      this.rowTicket.set(node.getAttr('ticket') ?? 'General');
      this.rowSeats.set(node.getAttr('seats') ?? 10);
      this.rowSeatRadius.set(node.getAttr('seat_radius') ?? 12);
      this.rowHeight.set(node.getAttr('row_height') ?? 28);
    } else {
      this.propTitle.set(''); this.propDesc.set('');
    }
  }
  private clearSelection() {
    this.selectedId.set(null);
    this.detachTransformer();
    this.propInvalidMsg.set(null);
    this.rowPreviewEnabled.set(false);
    this.previewRowY.set(null);
    this.removeRowPreview();
    this.uiLayer.batchDraw();
  }

  // ===== Transformer
  private attachTransformer(node: Konva.Node) {
    this.detachTransformer();
    const kind = node.getAttr('seats_kind');

    if (kind === 'sector' && node instanceof Konva.Group) {
      const shape = node.findOne<Konva.Shape>('.sector-shape') || node.findOne<Konva.Shape>('Rect,Ellipse,Line');
      if (!shape) return;
      const tr = new Konva.Transformer({
        id:'main-transformer', rotateEnabled:false,
        enabledAnchors:['top-left','top-center','top-right','middle-left','middle-right','bottom-left','bottom-center','bottom-right'],
        anchorSize:8, borderStroke:'#3b82f6', anchorStroke:'#3b82f6', anchorFill:'#fff'
      });
      shape.off('transform.resizefix');
      shape.on('transform.resizefix', () => {
        if (shape instanceof Konva.Rect) {
          shape.width(shape.width()*shape.scaleX()); shape.height(shape.height()*shape.scaleY()); shape.scale({x:1,y:1});
          node.setAttr('bounds',{ width:shape.width(), height:shape.height() });
        } else if (shape instanceof Konva.Ellipse) {
          shape.radiusX(shape.radiusX()*shape.scaleX()); shape.radiusY(shape.radiusY()*shape.scaleY()); shape.scale({x:1,y:1});
          node.setAttr('bounds',{ width: shape.radiusX()*2, height: shape.radiusY()*2 });
        } else if (shape instanceof Konva.Line) {
          const sx = shape.scaleX(), sy = shape.scaleY();
          if (sx!==1 || sy!==1) { const pts = shape.points(); for (let i=0;i<pts.length;i+=2){ pts[i]*=sx; pts[i+1]*=sy; } shape.points(pts); shape.scale({x:1,y:1}); }
          const br = shape.getClientRect({ relativeTo: node }); node.setAttr('bounds',{ width: br.width, height: br.height });
        }
        // Redimensionar sector: solo actualizar clip y anchos, NO tocar filas
        this.updateRowsClip(node);
        this.updateRowBandsForSector(node);
      });
      shape.off('transformend.resizefix');
      shape.on('transformend.resizefix', () => { this.drawLayer.batchDraw(); this.uiLayer.batchDraw(); this.pushHistory(); });

      this.uiLayer.add(tr); tr.nodes([shape as any]); this.uiLayer.batchDraw(); return;
    }

    if (kind === 'row') {
      const tr = new Konva.Transformer({ id:'main-transformer', rotateEnabled:false, enabledAnchors:[], anchorSize:8, borderStroke:'#3b82f6' });
      node.off('dragend.history');
      node.on('dragend.history', () => {
        const sectorGroup = (node.getParent()?.getParent() as Konva.Group) ?? (node.getParent() as Konva.Group);
        this.refreshRowVisual(node as Konva.Group, sectorGroup);
        this.pushHistory();
      });
      this.uiLayer.add(tr); tr.nodes([node as any]); this.uiLayer.batchDraw(); return;
    }

    const tr = new Konva.Transformer({ id:'main-transformer', rotateEnabled:true,
      enabledAnchors:['top-left','top-center','top-right','middle-left','middle-right','bottom-left','bottom-center','bottom-right'],
      anchorSize:8, borderStroke:'#3b82f6', anchorStroke:'#3b82f6', anchorFill:'#fff' });
    node.off('dragend.history'); node.on('dragend.history', () => { this.drawLayer.batchDraw(); this.pushHistory(); });
    this.uiLayer.add(tr); tr.nodes([node as any]); this.uiLayer.batchDraw();
  }
  private detachTransformer() { this.uiLayer.find('#main-transformer').forEach(n => n.destroy()); }
  private isTransformerTarget(node: Konva.Node | null | undefined): boolean {
    if (!node) return false;
    if ((node as any).getClassName?.() === 'Transformer') return true;
    let p: Konva.Node | null = node;
    while (p) { if ((p as any).getClassName?.() === 'Transformer') return true; p = p.getParent(); }
    return false;
  }

  /** Solo ancho de bandas/área de hit (no toca posiciones ni radios). */
  private updateRowBandsForSector(sector: Konva.Group) {
    const bounds = (sector.getAttr('bounds') || { width: 200, height: 120 }) as { width: number; height: number };
    const w = bounds.width;
    const rows = this.getRows(sector);
    for (const row of rows) {
      const h = Number(row.getAttr('row_height') ?? 28);
      const band = row.findOne<Konva.Rect>('.row-band'); if (band) { band.width(w); band.height(h); }
      const label = row.findOne<Konva.Text>('.row-label');
      const hit   = row.findOne<Konva.Rect>('.row-hit');
      if (label && hit) { hit.x(-label.width() - 16); hit.width(w + label.width() + 16); hit.height(h); }
    }
  }

  // ===== Undo/Redo/Clipboard
  private pushHistory() {
    if (this.suppressHistory) return;
    const snapshot = this.drawLayer.getChildren().map(n => n.toJSON());
    this.undoStack.push(snapshot); this.redoStack = [];
  }
  private restoreHistory(snapshot: string[]) {
    this.suppressHistory = true;
    try {
      this.detachTransformer();
      this.drawLayer.destroyChildren();
      for (const json of snapshot) {
        const node = Konva.Node.create(json) as Konva.Node;
        const kind = node.getAttr('seats_kind');
        if (kind === 'sector') {
          this.getRowsContainer(node as Konva.Group, true);
          this.updateRowsClip(node as Konva.Group);
          this.wireSector(node as Konva.Group);
        }
        if (kind === 'row') {
          node.on('click tap', (e)=>{ e.cancelBubble = true; this.selectNode(node); });
          node.on('dragend.history', () => this.pushHistory());
        }
        this.addToDrawLayer(node);
      }
      this.drawLayer.batchDraw(); this.selectedId.set(null);
    } finally { this.suppressHistory = false; }
  }
  undo() { if (this.undoStack.length <= 1) return; const current = this.undoStack.pop()!; const prev = this.undoStack[this.undoStack.length-1]; this.redoStack.push(current); this.restoreHistory(prev); }
  redo() { if (!this.redoStack.length) return; const next = this.redoStack.pop()!; const current = this.drawLayer.getChildren().map(n=>n.toJSON()); this.undoStack.push(current); this.restoreHistory(next); }
  private copySelection() { const id = this.selectedId(); if (!id) return; const node = this.drawLayer.findOne('#'+id); if (!node) return; this.clipboardJSON = [node.toJSON()]; }
  private pasteClipboard() {
    if (!this.clipboardJSON?.length) return;
    const newNodes: Konva.Node[] = [];
    for (const json of this.clipboardJSON) {
      const clone = Konva.Node.create(json) as Konva.Node;
      clone.id(this.reid(clone.id()));
      const cx = (clone as any).x?.() ?? 0, cy = (clone as any).y?.() ?? 0;
      (clone as any).x?.(cx + 12); (clone as any).y?.(cy + 12);
      if (clone.getAttr('seats_kind') === 'sector') {
        const t = clone.getAttr('seats_title') ?? 'Sector';
        clone.setAttr('seats_title', this.ensureUniqueTitle(t));
        this.getRowsContainer(clone as Konva.Group, true);
        this.updateRowsClip(clone as Konva.Group);
        this.wireSector(clone as Konva.Group);
      }
      if (clone.getAttr('seats_kind') === 'row') {
        clone.on('click tap', (e)=>{ e.cancelBubble = true; this.selectNode(clone); });
        clone.on('dragend.history', () => this.pushHistory());
      }
      this.addToDrawLayer(clone); newNodes.push(clone);
    }
    this.drawLayer.batchDraw(); if (newNodes.length) this.selectNode(newNodes.at(-1)!); this.pushHistory();
  }

  // ===== Utils
  private reid(oldId:string){ const base = oldId.replace(/_\w{4,8}$/, ''); return `${base}_${Math.random().toString(36).slice(2,8)}`; }
  private newId(prefix:string){ return `${prefix}_${Math.random().toString(36).slice(2,8)}`; }
  private toCanvas(p:{x:number;y:number}){ const s = this.stage.scaleX(); return { x:(p.x - this.stage.x())/s, y:(p.y - this.stage.y())/s }; }
  private dist(a:Pt,b:Pt){ return Math.hypot(a.x-b.x, a.y-b.y); }

  private addToDrawLayer(n: Konva.Node) {
    if (n instanceof Konva.Group || n instanceof Konva.Rect || n instanceof Konva.Ellipse || n instanceof Konva.Line) this.drawLayer.add(n);
    else this.drawLayer.add(n as unknown as Konva.Shape);
  }
  private ensureUniqueTitle(base:string, excludeId?:string): string {
    const name = (base ?? '').trim() || 'Sector';
    const titles = new Set<string>();
    this.drawLayer.getChildren().forEach(n => {
      if (excludeId && n.id() === excludeId) return;
      if (n.getAttr('seats_kind') === 'sector') {
        const t = (n.getAttr('seats_title') ?? '').toString(); if (t) titles.add(t);
      }
    });
    if (!titles.has(name)) return name;
    for (let i=2; i<1000; i++){ const c = `${name} (${i})`; if (!titles.has(c)) return c; }
    return `${name} (${Math.random().toString(36).slice(2,4)})`;
  }
  private ensureUniqueRowName(sector:Konva.Group, base:string, excludeId?:string): string {
    const name = (base ?? '').trim() || 'Fila';
    const set = new Set<string>();
    this.getRows(sector).forEach(r => { if (excludeId && r.id() === excludeId) return; const t = (r.getAttr('row_name') ?? '').toString(); if (t) set.add(t); });
    if (!set.has(name)) return name;
    for (let i=2; i<1000; i++){ const c = `${name} (${i})`; if (!set.has(c)) return c; }
    return `${name} (${Math.random().toString(36).slice(2,4)})`;
  }
  private nextRowLetter(sector:Konva.Group): string {
    const rows = this.getRows(sector).map(r => (r.getAttr('row_name') ?? '').toString());
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    for (let i=0;i<letters.length;i++){ const n = `Fila ${letters[i]}`; if (!rows.includes(n)) return n; }
    return this.ensureUniqueRowName(sector, 'Fila');
  }

  // ===== Preview fila
  toggleRowPreview() {
    if (!this.isSectorSelected()) return;
    this.rowPreviewEnabled.set(!this.rowPreviewEnabled());
    this.previewRowY.set(null);
    if (!this.rowPreviewEnabled()) this.removeRowPreview();
  }
  private renderRowPreview() {
    if (!this.rowPreviewEnabled()) { this.removeRowPreview(); return; }
    const sector = this.getSelectedNode();
    if (!sector || sector.getAttr('seats_kind') !== 'sector') { this.removeRowPreview(); return; }

    const g = sector as Konva.Group;
    const bounds = (g.getAttr('bounds') || { width:200, height:120 }) as { width:number; height:number };
    const w = bounds.width;
    const y = Math.max(0, Math.min(this.previewRowY() ?? 0, bounds.height - this.rowHeight()));

    let ghost = this.uiLayer.findOne<Konva.Group>('#row-preview');
    if (!ghost) { ghost = new Konva.Group({ id:'row-preview', listening:false, opacity:0.7 }); this.uiLayer.add(ghost); }
    ghost.destroyChildren();

    const abs = g.getAbsolutePosition(); const scale = this.stage.scaleX();

    const band = new Konva.Rect({ x: abs.x, y: abs.y + y*scale, width: w*scale, height: this.rowHeight()*scale, fill:'#60a5fa33', stroke:'#3b82f6', strokeWidth:1 });
    ghost.add(band);

    const label = new Konva.Text({ text: this.rowName() || 'Fila', fontSize: 12*scale, fill:'#1f2937',
      x: abs.x - 8*scale, y: abs.y + (y + this.rowHeight()/2 - 8)*scale, align:'right' });
    label.x(abs.x - (label.width() + 8));
    ghost.add(label);

    const N = Math.max(1, Number(this.rowSeats()) | 0);
    const desiredR = Math.max(3, Number(this.rowSeatRadius()));
    const leftPad=12, rightPad=12;
    const usable = Math.max(0, w - leftPad - rightPad);
    const maxR = N > 0 ? Math.floor(usable / (2 * N)) : desiredR;
    const rEff = Math.max(2, Math.min(desiredR, maxR));

    const start = abs.x + (leftPad + rEff) * scale;
    const end   = abs.x + (w - rightPad - rEff) * scale;
    const step  = N > 1 ? (end - start) / (N - 1) : 0;
    const cy    = abs.y + (y + this.rowHeight()/2) * scale;

    for (let i=0;i<N;i++){
      const cx = N > 1 ? start + i * step : abs.x + (w/2) * scale;
      ghost.add(new Konva.Circle({ x: cx, y: cy, radius: rEff * scale, fill:'#fff', stroke:'#1f2937', strokeWidth: 1 }));
    }
    this.uiLayer.batchDraw();
  }
  private removeRowPreview(){ this.uiLayer.findOne('#row-preview')?.destroy(); this.uiLayer.batchDraw(); }

  // ===== Toolbar
  setTool(t: Tool) {
    if (this.isDrawingPoly() && t !== 'poly') this.cancelPolygon();
    this.tool.set(t);
    if (t !== 'select') this.clearSelection();
  }
  zoomFit() { this.stage.scale({ x: 1, y: 1 }); this.stage.position({ x: 0, y: 0 }); this.stage.batchDraw(); }
  deleteSelected() {
    const id = this.selectedId(); if (!id) return;
    const n = this.drawLayer.findOne('#' + id); if (!n) return;
    n.destroy(); this.detachTransformer(); this.selectedId.set(null);
    this.drawLayer.batchDraw(); this.pushHistory();
  }

  // ===== Get seleccionado
  private getSelectedNode(): Konva.Node | null { const id = this.selectedId(); if (!id) return null; return this.drawLayer.findOne('#'+id) as Konva.Node | null; }
}