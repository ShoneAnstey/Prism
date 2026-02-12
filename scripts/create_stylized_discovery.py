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
    width, height = 1280, 800
    script_dir = os.path.dirname(os.path.abspath(__file__))
    project_root = os.path.dirname(script_dir)
    images_dir = os.path.join(project_root, 'images')
    output_path = os.path.join(images_dir, 'store_screenshot_3_discovery_stylized.png')
    icon_path = os.path.join(images_dir, 'icon128.png')

    print(f"🎨 Generating Stylized Discovery Image ({width}x{height})...")

    # 1. Background: Dark "Browser Theme" Gradient
    bg = create_gradient(width, height, (30, 30, 30), (10, 10, 10))
    draw = ImageDraw.Draw(bg)

    # 2. Simulated Toolbar Area
    toolbar_height = 200
    draw.rectangle([(0, 100), (width, 100 + toolbar_height)], fill=(40, 40, 40))
    # Omnibox
    omnibox_margin = 100
    draw.rectangle([(omnibox_margin, 140), (width - 300, 140 + 120)], fill=(20, 20, 20), outline=(60,60,60), width=2)

    # 3. Place Icon (The Star)
    if os.path.exists(icon_path):
        icon = Image.open(icon_path).convert("RGBA")
        icon = icon.resize((150, 150), Image.Resampling.LANCZOS) # Make it big
        
        # Position in "Toolbar" area
        icon_x = width - 250
        icon_y = 125
        
        # Glow effect
        glow_size = (icon.width + 60, icon.height + 60)
        glow = Image.new('RGBA', glow_size, (0,0,0,0))
        glow_draw = ImageDraw.Draw(glow)
        for i in range(30):
            alpha = int(40 * (1 - i/30))
            offset = 30 - i
            glow_draw.ellipse([offset, offset, glow_size[0]-offset, glow_size[1]-offset], outline=(167, 139, 250, alpha), width=2)
        
        bg.paste(glow, (icon_x - 30, icon_y - 30), glow)
        bg.paste(icon, (icon_x, icon_y), icon)

        # 4. Notification Badge "1"
        badge_size = 60
        badge = Image.new('RGBA', (badge_size, badge_size), (0,0,0,0))
        badge_draw = ImageDraw.Draw(badge)
        badge_draw.ellipse([(0,0), (badge_size, badge_size)], fill=(167, 139, 250)) # Purple accent
        
        # Text "1"
        # Since we don't know fonts, we'll draw a "1" manually or just a filled circle?
        # Let's try to draw a simple "1" rectangle
        badge_draw.rectangle([(25, 10), (35, 50)], fill="white")
        
        bg.paste(badge, (icon_x + 90, icon_y + 90), badge)

    # 5. Text / Arrow
    # Draw a stylized arrow pointing to it?
    # No, keep it clean.
    
    # 6. Add "Feed Detected" toast notification simulation below
    toast_w, toast_h = 400, 100
    toast_x = width - 400 - 50
    toast_y = 100 + toolbar_height + 20
    
    draw.rectangle([(toast_x, toast_y), (toast_x + toast_w, toast_y + toast_h)], fill=(26, 26, 46), outline=(167, 139, 250), width=2)
    
    # "Text" lines in toast
    draw.rectangle([(toast_x + 20, toast_y + 30), (toast_x + 300, toast_y + 40)], fill=(200, 200, 200))
    draw.rectangle([(toast_x + 20, toast_y + 60), (toast_x + 200, toast_y + 70)], fill=(100, 100, 100))

    bg.save(output_path)
    print(f"✨ Saved stylized image: {os.path.basename(output_path)}")

if __name__ == "__main__":
    main()
