from PIL import Image, ImageDraw

def create_diamond_icon():
    # Create a 128x128 image with transparency
    size = 128
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # Diamond coordinates
    # Top flat edge
    top_y = 30
    mid_y = 55
    bot_y = 110
    
    # Widths
    top_width = 80
    mid_width = 110
    
    # Centers
    cx = size // 2
    
    # Points
    p_top_l = (cx - top_width // 2, top_y)
    p_top_r = (cx + top_width // 2, top_y)
    p_mid_l = (cx - mid_width // 2, mid_y)
    p_mid_r = (cx + mid_width // 2, mid_y)
    p_bot = (cx, bot_y)
    
    # Colors
    color_top = (0, 255, 255, 255)      # Cyan
    color_mid_l = (0, 150, 255, 255)    # Medium Blue
    color_mid_c = (50, 200, 255, 255)   # Light Blue (center facet)
    color_mid_r = (0, 100, 200, 255)    # Darker Blue
    color_bot_l = (0, 0, 180, 255)      # Dark Blue
    color_bot_r = (0, 0, 100, 255)      # Navy Blue

    # Draw Top Facet (Trapezoid -> Triangle fan for simplicity)
    # Top face
    draw.polygon([p_top_l, p_top_r, p_mid_r, p_mid_l], fill=(0, 200, 255, 255), outline=(255,255,255,100))
    
    # Add some "shine" or facets
    # Left Middle Facet
    draw.polygon([p_top_l, p_mid_l, (cx, mid_y)], fill=color_mid_l)
    
    # Right Middle Facet
    draw.polygon([p_top_r, p_mid_r, (cx, mid_y)], fill=color_mid_r)
    
    # Center Top Facet
    draw.polygon([p_top_l, p_top_r, (cx, mid_y)], fill=color_top)

    # Bottom Facets
    # Left Bottom
    draw.polygon([p_mid_l, (cx, mid_y), p_bot], fill=color_bot_l)
    
    # Right Bottom
    draw.polygon([p_mid_r, (cx, mid_y), p_bot], fill=color_bot_r)
    
    # White Highlight Outline
    draw.line([p_top_l, p_top_r], fill=(255, 255, 255, 200), width=2)
    draw.line([p_top_l, p_mid_l], fill=(255, 255, 255, 150), width=1)
    
    img.save("../images/icon128.png")
    print("Icon generated: icon128.png")

if __name__ == "__main__":
    create_diamond_icon()
