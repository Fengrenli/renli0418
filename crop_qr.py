from PIL import Image

def find_qr_square():
    img = Image.open('E:/renli0418/public/new_wechat_screenshot.png')
    gray = img.convert('L')
    w, h = gray.size
    
    # Threshold to find white area
    # We are looking for a square with white background.
    # The QR code bits are black. 
    # Let's find the bounding box of the whole white area.
    
    # We scan for the white pixels (>= 250) in the lower half
    white_pixels = []
    for y in range(h // 2, h):
        for x in range(w):
            if gray.getpixel((x, y)) >= 250:
                white_pixels.append((x, y))
                
    if not white_pixels:
        print("No white pixels found")
        return

    # Find the bounds of the largest contiguous white area? 
    # No, just find the min/max of the cluster.
    # Actually, the screenshot has other white areas (title bars). 
    # But we only looked in the lower half.
    
    min_x = min(p[0] for p in white_pixels)
    max_x = max(p[0] for p in white_pixels)
    min_y = min(p[1] for p in white_pixels)
    max_y = max(p[1] for p in white_pixels)
    
    # Refine: filter out stray pixels. 
    # Let's count white pixels per line.
    lines = {}
    for x, y in white_pixels:
        lines[y] = lines.get(y, 0) + 1
    
    # Keep lines that have a lot of white pixels (the square background)
    valid_y = [y for y, count in lines.items() if count > 300]
    if not valid_y:
        print("Could not find square lines")
        return
    
    min_y = min(valid_y)
    max_y = max(valid_y)
    
    # Find x bounds for these y lines
    valid_x = []
    for x, y in white_pixels:
        if min_y <= y <= max_y:
            valid_x.append(x)
            
    min_x = min(valid_x)
    max_x = max(valid_x)
    
    # Crop with small padding to be safe
    box = (min_x, min_y, max_x + 1, max_y + 1)
    crop = img.crop(box)
    crop.save('E:/renli0418/public/wechat-qr.png')
    print(f"Cropped to {box}")

find_qr_square()
