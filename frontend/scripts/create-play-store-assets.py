from pathlib import Path

from PIL import Image, ImageDraw, ImageEnhance, ImageFilter, ImageFont


ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / "public"
OUTPUT = ROOT / "play-store-assets"
OUTPUT.mkdir(parents=True, exist_ok=True)


def cover(image: Image.Image, size: tuple[int, int]) -> Image.Image:
    target_w, target_h = size
    scale = max(target_w / image.width, target_h / image.height)
    resized = image.resize(
        (round(image.width * scale), round(image.height * scale)),
        Image.Resampling.LANCZOS,
    )
    left = (resized.width - target_w) // 2
    top = (resized.height - target_h) // 2
    return resized.crop((left, top, left + target_w, top + target_h))


def font(name: str, size: int) -> ImageFont.FreeTypeFont:
    windows_fonts = Path("C:/Windows/Fonts")
    return ImageFont.truetype(str(windows_fonts / name), size)


# Keep a clearly named copy beside the feature graphic for easy Play Console upload.
icon = Image.open(PUBLIC / "icon-512.png").convert("RGBA")
if icon.size != (512, 512):
    raise ValueError(f"Expected a 512 x 512 icon, got {icon.size}")
icon.save(OUTPUT / "cda-connect-app-icon-512.png", optimize=True)


canvas_size = (1024, 500)
photo = cover(Image.open(PUBLIC / "welcome-community.webp").convert("RGB"), canvas_size)
photo = ImageEnhance.Contrast(photo).enhance(1.04)
photo = ImageEnhance.Color(photo).enhance(0.92)
canvas = photo.convert("RGBA")

# A navy gradient keeps the brand and message legible while retaining the community scene.
overlay = Image.new("RGBA", canvas_size, (0, 0, 0, 0))
pixels = overlay.load()
for x in range(canvas_size[0]):
    progress = x / (canvas_size[0] - 1)
    alpha = round(222 * (1 - progress) + 54 * progress)
    blue = round(54 + 18 * progress)
    for y in range(canvas_size[1]):
        pixels[x, y] = (3, 42, blue, alpha)
canvas = Image.alpha_composite(canvas, overlay)

draw = ImageDraw.Draw(canvas)

# Subtle brand-colour accents.
draw.ellipse((-185, 355, 215, 755), fill=(0, 174, 239, 42))
draw.ellipse((765, -270, 1185, 150), fill=(45, 207, 69, 34))

brand_icon = Image.open(PUBLIC / "brand-logo.webp").convert("RGBA")
brand_icon.thumbnail((122, 110), Image.Resampling.LANCZOS)
canvas.alpha_composite(brand_icon, (72, 62))

wordmark = Image.open(PUBLIC / "brand-wordmark.webp").convert("RGBA")
wordmark.thumbnail((360, 120), Image.Resampling.LANCZOS)

# A soft white plate preserves the exact coloured wordmark on the photographic background.
plate = Image.new("RGBA", (wordmark.width + 38, wordmark.height + 24), (255, 255, 255, 234))
plate = plate.filter(ImageFilter.GaussianBlur(0.25))
plate_x, plate_y = 204, 73
canvas.alpha_composite(plate, (plate_x, plate_y))
canvas.alpha_composite(wordmark, (plate_x + 19, plate_y + 12))

headline = "Your community, connected."
subline = "Share updates  •  Organise together  •  Stay informed"
draw.text((72, 230), headline, font=font("segoeuib.ttf", 43), fill=(255, 255, 255, 255))
draw.text((74, 298), subline, font=font("segoeui.ttf", 22), fill=(226, 240, 250, 255))

# Short accent rule in CDA Connect colours.
draw.rounded_rectangle((74, 365, 198, 372), radius=4, fill=(0, 174, 239, 255))
draw.rounded_rectangle((205, 365, 282, 372), radius=4, fill=(45, 207, 69, 255))

feature_path = OUTPUT / "cda-connect-feature-graphic-1024x500.png"
canvas.convert("RGB").save(feature_path, format="PNG", optimize=True)


def create_phone_store_screenshot(
    source_name: str,
    output_name: str,
    headline: str,
    supporting_text: str,
) -> Path:
    width, height = 1080, 1920
    background = Image.new("RGB", (width, height), "#F4F8FC")
    backdrop = ImageDraw.Draw(background)

    # Branded header and decorative accents frame a genuine in-app capture.
    backdrop.rectangle((0, 0, width, 310), fill="#073D78")
    backdrop.ellipse((820, -170, 1170, 180), fill="#00AEEF")
    backdrop.ellipse((-155, 1690, 245, 2090), fill="#2DCF45")

    small_logo = Image.open(PUBLIC / "brand-logo.webp").convert("RGBA")
    small_logo.thumbnail((100, 90), Image.Resampling.LANCZOS)
    background.paste(small_logo, (72, 50), small_logo)

    header_draw = ImageDraw.Draw(background)
    header_draw.text(
        (194, 54),
        headline,
        font=font("segoeuib.ttf", 48),
        fill="white",
    )
    header_draw.text(
        (196, 126),
        supporting_text,
        font=font("segoeui.ttf", 27),
        fill="#DCECF8",
    )

    screenshot_path = ROOT / "tests" / "e2e" / "snapshots" / source_name
    screenshot = Image.open(screenshot_path).convert("RGB")
    screenshot_draw = ImageDraw.Draw(screenshot)
    if source_name == "home-390.png":
        screenshot_draw.rectangle((5, 89, 278, 116), fill="#F5F8FC")
        screenshot_draw.text(
            (8, 92),
            "Good afternoon, Member",
            font=font("segoeuib.ttf", 16),
            fill="#07152F",
        )
    elif source_name == "profile-390.png":
        screenshot_draw.rectangle((127, 198, 389, 249), fill="#F5F8FC")
        screenshot_draw.text(
            (132, 204),
            "Community Member",
            font=font("segoeuib.ttf", 16),
            fill="#073D78",
        )
        screenshot_draw.text(
            (132, 229),
            "Member since Jan 2026",
            font=font("segoeui.ttf", 12),
            fill="#65758D",
        )
    screenshot = screenshot.resize((650, 1500), Image.Resampling.LANCZOS)

    # Soft shadow and rounded phone-like presentation.
    shadow = Image.new("RGBA", (710, 1560), (0, 0, 0, 0))
    shadow_draw = ImageDraw.Draw(shadow)
    shadow_draw.rounded_rectangle((20, 20, 690, 1540), radius=54, fill=(1, 31, 68, 78))
    shadow = shadow.filter(ImageFilter.GaussianBlur(18))
    background.paste(shadow, (185, 302), shadow)

    mask = Image.new("L", screenshot.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle(
        (0, 0, screenshot.width - 1, screenshot.height - 1),
        radius=38,
        fill=255,
    )
    background.paste(screenshot, (215, 322), mask)

    output_path = OUTPUT / output_name
    background.save(output_path, format="PNG", optimize=True)
    return output_path


phone_screenshots = [
    create_phone_store_screenshot(
        "home-390.png",
        "01-home-stay-connected-1080x1920.png",
        "Stay connected",
        "See community news and recent activity at a glance.",
    ),
    create_phone_store_screenshot(
        "community-390.png",
        "02-community-tools-1080x1920.png",
        "Community tools",
        "Posts, chat, events, polls, documents and more.",
    ),
    create_phone_store_screenshot(
        "profile-390.png",
        "03-profile-control-1080x1920.png",
        "Your profile",
        "Manage your community identity and activity.",
    ),
    create_phone_store_screenshot(
        "settings-390.png",
        "04-privacy-security-1080x1920.png",
        "Privacy and security",
        "Control notifications, data, passwords and active sessions.",
    ),
]

print(OUTPUT / "cda-connect-app-icon-512.png")
print(feature_path)
for phone_screenshot in phone_screenshots:
    print(phone_screenshot)
