from PIL import Image, ImageDraw, ImageFont
import os

def create_gradient(width, height, start_color, end_color):
    base = Image.new('RGB', (width, height), start_color)
    top = Image.new('RGB', (width, height), end_color)
    mask = Image.new('L', (width, height))
    mask_data = []
    for y in range(height):
        for x in range(width):
            # Diagonal gradient
            mask_data.append(int(255 * (x + y) / (width + height)))
    mask.putdata(mask_data)
    base.paste(top, (0,0), mask)
    return base

def main():
    width, height = 1400, 560
    script_dir = os.path.dirname(os.path.abspath(__file__))
    project_root = os.path.dirname(script_dir)
    images_dir = os.path.join(project_root, 'images')
    
    output_path = os.path.join(images_dir, 'store_promo_marquee_1400x560.png')
    icon_path = os.path.join(images_dir, 'icon128.png')

    print(f"🎨 Generating Marquee Promo Tile ({width}x{height})...")

    # Dark gradient background
    bg = create_gradient(width, height, (20, 20, 35), (10, 10, 20))
    draw = ImageDraw.Draw(bg)

    # Place Icon (Left Side)
    if os.path.exists(icon_path):
        icon = Image.open(icon_path).convert("RGBA")
        icon = icon.resize((250, 250), Image.Resampling.LANCZOS)
        
        # Add glow
        glow_size = (350, 350)
        glow = Image.new('RGBA', glow_size, (0,0,0,0))
        glow_draw = ImageDraw.Draw(glow)
        center = (175, 175)
        for i in range(50):
            alpha = int(30 * (1 - i/50))
            glow_draw.ellipse([i, i, 350-i, 350-i], outline=(167, 139, 250, alpha), width=3)
        
        icon_x = 150
        icon_y = (height - 250) // 2
        bg.paste(glow, (icon_x - 50, icon_y - 50), glow)
        bg.paste(icon, (icon_x, icon_y), icon)

    # Add Text (Right Side)
    # Try to load a nice font, fallback to default
    try:
        # Try common fonts
        title_font = ImageFont.truetype("arial.ttf", 120)
        subtitle_font = ImageFont.truetype("arial.ttf", 60)
    except:
        try:
           title_font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 100)
           subtitle_font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 50)
        except:
            print("⚠️  Custom fonts not found, using default (will look plain)")
            title_font = ImageFont.load_default()
            subtitle_font = ImageFont.load_default()

    # Draw Text
    text_x = 500
    text_y_start = 180
    
    # Title: PRISM READER
    draw.text((text_x, text_y_start), "PRISM READER", font=title_font, fill=(255, 255, 255))
    
    # Tagline: Open Source
    draw.text((text_x, text_y_start + 140), "Pure. Private. Open Source.", font=subtitle_font, fill=(180, 180, 200))
    
    # Decoration line
    draw.line([(text_x, text_y_start + 130), (text_x + 600, text_y_start + 130)], fill=(167, 139, 250), width=4)

    bg.save(output_path)
    print(f"✨ Saved: {os.path.basename(output_path)}")

if __name__ == "__main__":
    main()
