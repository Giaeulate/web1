from django import template
import io, base64
import qrcode

register = template.Library()

@register.simple_tag
def qr_data_uri(data, box_size=6, border=2):
    """
    Genera un data URI PNG con el QR del texto 'data'.
    Requiere qrcode + Pillow.
    """
    if not data:
        return ""
    qr = qrcode.QRCode(
        version=None,  # auto
        error_correction=qrcode.constants.ERROR_CORRECT_M,
        box_size=int(box_size),
        border=int(border),
    )
    qr.add_data(data)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white")
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    encoded = base64.b64encode(buf.getvalue()).decode("ascii")
    return f"data:image/png;base64,{encoded}"
