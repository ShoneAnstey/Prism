import os
import zipfile
import json
import shutil

def main():
    # Define paths
    script_dir = os.path.dirname(os.path.abspath(__file__))
    root_dir = os.path.dirname(script_dir)
    manifest_path = os.path.join(root_dir, 'manifest.json')

    # Read version from manifest
    with open(manifest_path, 'r', encoding='utf-8') as f:
        manifest = json.load(f)
    version = manifest.get('version', 'unknown')
    
    zip_filename = f"prism-reader-v{version}.zip"
    zip_path = os.path.join(root_dir, zip_filename)

    print(f"📦 Packaging Prism Reader v{version}...")

    # Files/Dirs to exclude
    EXCLUDE_DIRS = {'.git', 'scripts', 'docs', '.vscode', '__pycache__'}
    EXCLUDE_FILES = {'.gitignore', '.DS_Store', 'desktop.ini', 'Thumbs.db', zip_filename}
    
    with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
        for root, dirs, files in os.walk(root_dir):
            # Modify dirs in-place to skip excluded directories
            dirs[:] = [d for d in dirs if d not in EXCLUDE_DIRS]
            
            for file in files:
                if file in EXCLUDE_FILES or file.endswith('.zip'):
                    continue
                
                # Exclude store assets (screenshots, promo tiles) from the extension package
                if file.startswith('store_') or file.startswith('promo_'):
                    continue

                abs_path = os.path.join(root, file)
                rel_path = os.path.relpath(abs_path, root_dir)
                
                print(f"  Adding: {rel_path}")
                zipf.write(abs_path, rel_path)

    print(f"\n✅ Successfully created: {zip_filename}")
    print(f"📍 Location: {zip_path}")

if __name__ == "__main__":
    main()
