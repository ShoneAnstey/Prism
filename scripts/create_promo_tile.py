from PIL import Image, ImageDraw, ImageFont
import os

def create_gradient(width, height, start_color, end_color):
    base = Image.new('RGB', (width, height), start_color)
    top = Image.new('RGB', (width, height), end_color)
    mask = Image.new('L', (width, height))
    mask_data = []
    for y in range(height):
        for x in range(width):
            mask_data.append(int(255 * (y / height)))
    mask.putdata(mask_data)
    base.paste(top, (0,0), mask)
    return base

def main():
    width, height = 440, 280
    script_dir = os.path.dirname(os.path.abspath(__file__))
    project_root = os.path.dirname(script_dir)
    images_dir = os.path.join(project_root, 'images')
    
    output_path = os.path.join(images_dir, 'store_promo_small_440x280.png')
    icon_path = os.path.join(images_dir, 'icon128.png')

    print(f"🎨 Generating Promo Tile ({width}x{height})...")

    # Dark gradient background
    bg = create_gradient(width, height, (26, 26, 46), (22, 33, 62))
    draw = ImageDraw.Draw(bg)

    if os.path.exists(icon_path):
        icon = Image.open(icon_path).convert("RGBA")
        
        # Center the icon, but higher up to make room for text
        icon_x = (width - icon.width) // 2
        icon_y = (height - icon.height) // 2 - 30 # Shift up
        
        # Glow
        glow_size = (icon.width + 40, icon.height + 40)
        glow = Image.new('RGBA', glow_size, (0,0,0,0))
        glow_draw = ImageDraw.Draw(glow)
        center = (glow_size[0]//2, glow_size[1]//2)
        radius = 70
        for i in range(20):
            alpha = int(50 * (1 - i/20))
            glow_draw.ellipse(
                (center[0] - radius - i, center[1] - radius - i, 
                 center[0] + radius + i, center[1] + radius + i),
                fill=None, outline=(167, 139, 250, alpha), width=2
            )

        bg.paste(glow, (icon_x - 20, icon_y - 20), glow)
        bg.paste(icon, (icon_x, icon_y), icon)
        print("   ✅ Added Icon")

    # Add Text: PRISM READER
    try:
       # Try system fonts or reliable fallback like DejaVu (Ubuntu)
       font = ImageFont.truetype("arial.ttf", 36)
    except:
       try:
           font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 32)
       except:
           font = ImageFont.load_default()

    text = "PRISM READER"
    
    # Calculate text size to center it
    # PIL defaults use getbbox
    bbox = draw.textbbox((0, 0), text, font=font)
    text_w = bbox[2] - bbox[0]
    text_h = bbox[3] - bbox[1]
    
    text_x = (width - text_w) // 2
    text_y = icon_y + 128 + 20 # Below icon
    
    draw.text((text_x, text_y), text, font=font, fill=(255, 255, 255))

    bg.save(output_path)
    print(f"✨ Saved: {os.path.basename(output_path)}")

if __name__ == "__main__":
    main()
