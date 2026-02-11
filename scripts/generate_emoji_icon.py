from PIL import Image, ImageDraw, ImageFont

def create_emoji_icon():
    # Create a 128x128 image with transparency
    size = 128
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # Try to load a font that supports emojis, or fallback to default
    try:
        # On Windows, Segoe UI Emoji is the standard
        font = ImageFont.truetype("seguiemj.ttf", 100)
    except IOError:
        try:
             # Linux fallback (adjust path as needed for your distro)
             font = ImageFont.truetype("/usr/share/fonts/truetype/noto/NotoColorEmoji.ttf", 109)
        except Exception as e:
            print(f"Warning: Emoji font error: {e}")
            draw.rectangle([20, 20, 108, 108], fill="blue")
            img.save("../images/icon128.png")
            return

    # Draw the emoji centered
    text = "💎"
    
    # Get bounding box to center
    try:
        left, top, right, bottom = draw.textbbox((0, 0), text, font=font)
        w = right - left
        h = bottom - top
        x = (size - w) // 2 - left
        y = (size - h) // 2 - top
        
        # Use 'embedded_color' feature of Pillow > 10.0 for colored emojis if supported
        draw.text((x, y), text, font=font, embedded_color=True)
        
        # --- Maximizing Size Logic ---
        # Get the bounding box of the non-transparent pixels
        bbox = img.getbbox()
        if bbox:
            # Crop the diamond
            diamond = img.crop(bbox)
            
            # Calculate new size to fit within 116x116 (leaving 6px padding)
            # This ensures it's BIG but not touching edges
            target_size = 116
            
            # Maintain aspect ratio
            dw, dh = diamond.size
            ratio = min(target_size / dw, target_size / dh)
            new_w = int(dw * ratio)
            new_h = int(dh * ratio)
            
            diamond = diamond.resize((new_w, new_h), Image.Resampling.LANCZOS)
            
            # Create final canvas
            final_img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
            
            # Center coordinates
            paste_x = (size - new_w) // 2
            paste_y = (size - new_h) // 2
            
            final_img.paste(diamond, (paste_x, paste_y))
            img = final_img
            
    except Exception as e:
        print(f"Error drawing/resizing: {e}")
        # Fallback
        draw.text((14, 14), text, font=font, fill="white")

    img.save("../images/icon128.png")
    print("Emoji Icon generated: icon128.png")

if __name__ == "__main__":
    create_emoji_icon()
