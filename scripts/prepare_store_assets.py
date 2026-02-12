from PIL import Image, ImageOps, ImageDraw
import os

def process_image(filepath, output_path, target_size=(1280, 800), bg_color=(17, 17, 17), redact_avatar=True):
    """Resizes and pads an image to fit target_size while maintaining aspect ratio."""
    with Image.open(filepath) as img:
        # 1. Redact Profile Picture (Top Right of Browser Interface)
        # Assuming standard Chrome/Edge layout, profile is near top right below window controls
        if redact_avatar:
            draw = ImageDraw.Draw(img)
            w, h = img.size
            # Top-right corner coordinates for standard 1080p/2K browser window
            # Approx 150px from right, 0-100px from top covers the avatar area in toolbar
            # Adjust these coordinates if needed based on actual screenshot check
            
            # For 2560px wide image:
            # Avatar usually at ~2400-2500 x 40-100
            
            # Let's create a "Cover-up" patch that looks like the dark toolbar
            # Color: #262626 (approx dark mode toolbar gray) or just black triangle?
            # Better: Sample the color near it
            try:
                # Sample color at (width - 200, 50) - likely toolbar background
                sample_color = img.getpixel((w - 200, 50))
            except:
                sample_color = (40, 40, 40) # Fallback dark gray
            
            # Draw a circle or rounded rect over the avatar
            # Avatar center approx (w - 80, 45) for maximized window?
            # Let's be aggressive: Mask the whole profile/menu area
            
            # Defining a mask area for top-right toolbar elements (Avatar + Menu)
            # x: w - 180 to w - 10
            # y: 10 to 80
            draw.rectangle([(w - 180, 0), (w, 100)], fill=sample_color)
            print(f"   🙈 Redacted top-right corner for {os.path.basename(filepath)}")

        # 2. Convert to RGB (in case of RGBA) to handle background color correctly
        if img.mode == 'RGBA':
            background = Image.new('RGB', img.size, bg_color)
            background.paste(img, mask=img.split()[3])
            img = background
        else:
            img = img.convert('RGB')

        # 3. Calculate the scaling factor to fit within target window
        ratio = min(target_size[0] / img.width, target_size[1] / img.height)
        new_size = (int(img.width * ratio), int(img.height * ratio))
        
        # 4. Resize using high-quality resampling
        img = img.resize(new_size, Image.Resampling.LANCZOS)
        
        # 5. Create a new background image
        new_img = Image.new("RGB", target_size, bg_color)
        
        # 6. Paste the resized image into the center
        paste_x = (target_size[0] - new_size[0]) // 2
        paste_y = (target_size[1] - new_size[1]) // 2
        new_img.paste(img, (paste_x, paste_y))
        
        new_img.save(output_path)
        print(f"✅ Processed: {os.path.basename(output_path)} ({target_size[0]}x{target_size[1]})")

def main():
    script_dir = os.path.dirname(os.path.abspath(__file__))
    project_root = os.path.dirname(script_dir)
    images_dir = os.path.join(project_root, 'images')
    
    # Map input filenames to store requirements
    mapping = {
        'home.png': 'store_screenshot_1_dashboard.png',
        'reader.png': 'store_screenshot_2_reader.png'
        # Skipping discovery because we generated a stylized one separately
    }
    
    print("🎨 Preparing Store Assets (Target: 1280x800)...")
    
    for input_name, output_name in mapping.items():
        input_path = os.path.join(images_dir, input_name)
        output_path = os.path.join(images_dir, output_name)
        
        if os.path.exists(input_path):
            process_image(input_path, output_path, redact_avatar=True)
        else:
            print(f"⚠️  Skipping {input_name} (Not found)")

    print("\n✨ Done! Store screenshots updated with redaction.")

if __name__ == "__main__":
    main()
