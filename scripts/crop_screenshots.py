from PIL import Image
import os

def main():
    script_dir = os.path.dirname(os.path.abspath(__file__))
    root_dir = os.path.dirname(script_dir)
    images_dir = os.path.join(root_dir, 'images')
    
    # Target image to process (you can change this or loop through all *.png)
    target_files = [f for f in os.listdir(images_dir) if f.lower().endswith(('.png', '.jpg'))]
    
    for filename in target_files:
        filepath = os.path.join(images_dir, filename)
        
        try:
            with Image.open(filepath) as img:
                width, height = img.size
                
                # Check if it's a triple monitor screenshot (approx 5760 wide)
                if width > 3000 and height > 800:
                    print(f"🖼️  Processing wide screenshot: {filename} ({width}x{height})")
                    
                    # Assume 3x 1080p monitors
                    monitor_width = width // 3
                    
                    # Crop Center Monitor (Monitor 2)
                    left = monitor_width
                    right = monitor_width * 2
                    # box = (left, top, right, bottom)
                    center_box = (left, 0, right, height)
                    
                    center_img = img.crop(center_box)
                    output_filename = f"monitor_center_{filename}"
                    output_path = os.path.join(images_dir, output_filename)
                    
                    center_img.save(output_path)
                    print(f"   ✅ Saved Center Monitor: {output_filename}")

                    # Crop Left Monitor (Monitor 1)
                    left_box = (0, 0, monitor_width, height)
                    left_img = img.crop(left_box)
                    left_output = f"monitor_left_{filename}"
                    left_img.save(os.path.join(images_dir, left_output))
                    print(f"   ✅ Saved Left Monitor: {left_output}")
                    
        except Exception as e:
            print(f"❌ Error processing {filename}: {e}")

if __name__ == "__main__":
    main()
