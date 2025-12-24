# Practical OCR Implementation Examples

This document provides ready-to-use code examples for implementing table OCR using the top-recommended solutions.

## Table of Contents

1. [Installation Guides](#installation-guides)
2. [PaddleOCR Implementation](#paddleocr-implementation)
3. [Table Transformer Implementation](#table-transformer-implementation)
4. [Amazon Textract Implementation](#amazon-textract-implementation)
5. [Tesseract + OpenCV Implementation](#tesseract-opencv-implementation)
6. [Complete Production Pipeline](#complete-production-pipeline)
7. [AutoHotkey Integration](#autohotkey-integration)
8. [Troubleshooting Guide](#troubleshooting-guide)

---

## Installation Guides

### PaddleOCR

```bash
# Install PaddleOCR and dependencies
pip install paddleocr paddlepaddle

# For GPU support (optional, but recommended)
pip install paddlepaddle-gpu

# For table structure recognition
pip install "paddleocr[table]"

# Verify installation
python -c "from paddleocr import PaddleOCR; print('Success!')"
```

### Table Transformer

```bash
# Install required packages
pip install transformers torch torchvision pillow

# Install additional dependencies
pip install timm opencv-python

# Verify installation
python -c "from transformers import AutoModelForObjectDetection; print('Success!')"
```

### Amazon Textract

```bash
# Install AWS SDK
pip install boto3

# Configure AWS credentials (one-time setup)
aws configure
# Enter: Access Key ID, Secret Access Key, Region (e.g., us-east-1)

# Verify
python -c "import boto3; print('Success!')"
```

### Tesseract

```bash
# Ubuntu/Debian
sudo apt-get update
sudo apt-get install tesseract-ocr

# macOS
brew install tesseract

# Windows: Download installer from
# https://github.com/UB-Mannheim/tesseract/wiki

# Install Python wrapper
pip install pytesseract opencv-python

# Verify
tesseract --version
```

---

## PaddleOCR Implementation

### Basic Table Extraction

```python
#!/usr/bin/env python3
"""
PaddleOCR Table Extraction - Basic Example
"""

from paddleocr import PPStructure, save_structure_res
from PIL import Image
import os

class PaddleTableExtractor:
    def __init__(self, lang='en'):
        """
        Initialize PaddleOCR table engine
        
        Args:
            lang: Language code (default: 'en')
                  Supports: en, ch, french, german, korean, japanese
        """
        self.table_engine = PPStructure(
            table=True,
            ocr=True,
            show_log=False,
            lang=lang
        )
    
    def extract_table(self, image_path):
        """
        Extract table from image
        
        Args:
            image_path: Path to image file
            
        Returns:
            List of dictionaries containing table data
        """
        img = Image.open(image_path)
        result = self.table_engine(img)
        
        tables = []
        for item in result:
            if item['type'] == 'table':
                tables.append({
                    'bbox': item['bbox'],
                    'html': item['res'].get('html', ''),
                    'confidence': item.get('score', 0.0)
                })
        
        return tables
    
    def save_to_html(self, tables, output_path):
        """Save tables to HTML file"""
        html_content = '<html><body>\n'
        
        for idx, table in enumerate(tables):
            html_content += f'<h2>Table {idx + 1}</h2>\n'
            html_content += table['html'] + '\n'
        
        html_content += '</body></html>'
        
        with open(output_path, 'w', encoding='utf-8') as f:
            f.write(html_content)
    
    def table_to_csv(self, table_html):
        """Convert HTML table to CSV format"""
        from bs4 import BeautifulSoup
        import csv
        from io import StringIO
        
        soup = BeautifulSoup(table_html, 'html.parser')
        
        output = StringIO()
        writer = csv.writer(output)
        
        for row in soup.find_all('tr'):
            cells = []
            for cell in row.find_all(['td', 'th']):
                cells.append(cell.get_text(strip=True))
            writer.writerow(cells)
        
        return output.getvalue()

# Usage Example
if __name__ == '__main__':
    extractor = PaddleTableExtractor()
    
    # Extract from single image
    tables = extractor.extract_table('invoice.jpg')
    
    print(f"Found {len(tables)} tables")
    
    # Save to HTML
    extractor.save_to_html(tables, 'output.html')
    
    # Convert first table to CSV
    if tables:
        csv_data = extractor.table_to_csv(tables[0]['html'])
        with open('output.csv', 'w') as f:
            f.write(csv_data)
        print("Saved to output.csv")
```

### Advanced: Batch Processing with PaddleOCR

```python
#!/usr/bin/env python3
"""
PaddleOCR Batch Processing with Progress Tracking
"""

from paddleocr import PPStructure
from pathlib import Path
from tqdm import tqdm
import json
import concurrent.futures

class BatchTableExtractor:
    def __init__(self, lang='en', num_workers=4):
        self.lang = lang
        self.num_workers = num_workers
    
    def process_directory(self, input_dir, output_dir):
        """
        Process all images in a directory
        
        Args:
            input_dir: Directory containing images
            output_dir: Directory to save results
        """
        input_path = Path(input_dir)
        output_path = Path(output_dir)
        output_path.mkdir(exist_ok=True)
        
        # Find all image files
        image_extensions = {'.jpg', '.jpeg', '.png', '.tiff', '.bmp'}
        image_files = [
            f for f in input_path.iterdir() 
            if f.suffix.lower() in image_extensions
        ]
        
        print(f"Found {len(image_files)} images")
        
        # Process in parallel
        with concurrent.futures.ThreadPoolExecutor(max_workers=self.num_workers) as executor:
            futures = {
                executor.submit(self._process_single_image, img, output_path): img
                for img in image_files
            }
            
            # Show progress
            for future in tqdm(
                concurrent.futures.as_completed(futures),
                total=len(futures),
                desc="Processing"
            ):
                image_file = futures[future]
                try:
                    result = future.result()
                    print(f"✓ {image_file.name}: {result['table_count']} tables")
                except Exception as e:
                    print(f"✗ {image_file.name}: {str(e)}")
    
    def _process_single_image(self, image_path, output_dir):
        """Process a single image"""
        # Create new engine instance for thread safety
        engine = PPStructure(table=True, ocr=True, show_log=False, lang=self.lang)
        
        result = engine(str(image_path))
        
        tables = []
        for item in result:
            if item['type'] == 'table':
                tables.append({
                    'bbox': [int(x) for x in item['bbox']],
                    'html': item['res'].get('html', ''),
                    'confidence': float(item.get('score', 0.0))
                })
        
        # Save result
        output_file = output_dir / f"{image_path.stem}.json"
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump({
                'source_image': image_path.name,
                'table_count': len(tables),
                'tables': tables
            }, f, indent=2, ensure_ascii=False)
        
        return {'table_count': len(tables)}

# Usage
if __name__ == '__main__':
    extractor = BatchTableExtractor(num_workers=4)
    extractor.process_directory('input_images/', 'output_results/')
```

---

## Table Transformer Implementation

### Basic Table Structure Recognition

```python
#!/usr/bin/env python3
"""
Table Transformer Implementation
"""

import torch
from transformers import AutoModelForObjectDetection, TableTransformerForObjectDetection
from PIL import Image, ImageDraw
import numpy as np

class TableTransformerExtractor:
    def __init__(self, model_name="microsoft/table-transformer-structure-recognition"):
        """
        Initialize Table Transformer
        
        Args:
            model_name: Hugging Face model identifier
        """
        self.model = AutoModelForObjectDetection.from_pretrained(model_name)
        self.model.eval()
        
        # Use GPU if available
        self.device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
        self.model.to(self.device)
    
    def detect_table_structure(self, image_path, confidence_threshold=0.7):
        """
        Detect table structure (rows, columns, cells)
        
        Args:
            image_path: Path to image file
            confidence_threshold: Minimum confidence for detection
            
        Returns:
            Dictionary with detected elements
        """
        # Load and prepare image
        image = Image.open(image_path).convert('RGB')
        width, height = image.size
        
        # Prepare input
        pixel_values = self._prepare_image(image)
        
        # Run inference
        with torch.no_grad():
            outputs = self.model(pixel_values)
        
        # Process results
        target_sizes = torch.tensor([[height, width]])
        results = self._post_process(outputs, target_sizes, confidence_threshold)
        
        return results[0] if results else None
    
    def _prepare_image(self, image):
        """Prepare image for model input"""
        # Resize to model's expected size
        image = image.resize((1000, 1000))
        
        # Convert to tensor
        pixel_values = torch.tensor(np.array(image)).permute(2, 0, 1).unsqueeze(0)
        pixel_values = pixel_values.float() / 255.0
        
        return pixel_values.to(self.device)
    
    def _post_process(self, outputs, target_sizes, threshold):
        """Post-process model outputs"""
        logits, boxes = outputs.logits, outputs.pred_boxes
        
        results = []
        for logit, box, target_size in zip(logits, boxes, target_sizes):
            # Get probabilities
            probs = logit.softmax(-1)
            scores, labels = probs.max(-1)
            
            # Filter by confidence
            keep = scores > threshold
            scores = scores[keep]
            labels = labels[keep]
            boxes_kept = box[keep]
            
            # Convert boxes to pixel coordinates
            img_h, img_w = target_size
            boxes_scaled = boxes_kept * torch.tensor([img_w, img_h, img_w, img_h])
            
            # Convert from center format to corner format
            boxes_corner = self._center_to_corners(boxes_scaled)
            
            results.append({
                'boxes': boxes_corner.cpu().numpy(),
                'labels': labels.cpu().numpy(),
                'scores': scores.cpu().numpy()
            })
        
        return results
    
    def _center_to_corners(self, boxes):
        """Convert center format to corner format"""
        center_x, center_y, width, height = boxes.unbind(-1)
        x_min = center_x - width / 2
        y_min = center_y - height / 2
        x_max = center_x + width / 2
        y_max = center_y + height / 2
        return torch.stack([x_min, y_min, x_max, y_max], dim=-1)
    
    def visualize_structure(self, image_path, output_path, confidence_threshold=0.7):
        """Visualize detected table structure"""
        # Detect structure
        results = self.detect_table_structure(image_path, confidence_threshold)
        
        if not results:
            print("No table structure detected")
            return
        
        # Draw on image
        image = Image.open(image_path).convert('RGB')
        draw = ImageDraw.Draw(image)
        
        # Color map for different elements
        colors = {
            0: 'red',     # table
            1: 'blue',    # table column
            2: 'green',   # table row
            3: 'yellow',  # table column header
            4: 'orange',  # table projected row header
            5: 'purple'   # table spanning cell
        }
        
        for box, label, score in zip(results['boxes'], results['labels'], results['scores']):
            x1, y1, x2, y2 = box
            color = colors.get(label, 'white')
            draw.rectangle([x1, y1, x2, y2], outline=color, width=2)
            draw.text((x1, y1-10), f"{label}: {score:.2f}", fill=color)
        
        image.save(output_path)
        print(f"Visualization saved to {output_path}")

# Usage
if __name__ == '__main__':
    extractor = TableTransformerExtractor()
    
    # Detect structure
    results = extractor.detect_table_structure('table.jpg')
    
    if results:
        print(f"Detected {len(results['boxes'])} elements")
        print(f"Labels: {results['labels']}")
        print(f"Confidence scores: {results['scores']}")
    
    # Visualize
    extractor.visualize_structure('table.jpg', 'table_structure.jpg')
```

### Combined: Table Transformer + PaddleOCR

```python
#!/usr/bin/env python3
"""
Complete Pipeline: Structure Detection + OCR
"""

from table_transformer import TableTransformerExtractor
from paddleocr import PaddleOCR
from PIL import Image
import numpy as np

class CompletTableExtractor:
    def __init__(self):
        self.structure_model = TableTransformerExtractor()
        self.ocr = PaddleOCR(use_angle_cls=True, lang='en', show_log=False)
    
    def extract_complete_table(self, image_path):
        """
        Extract table with structure and OCR
        
        Returns:
            Structured table data with text
        """
        # Step 1: Detect table structure
        structure = self.structure_model.detect_table_structure(image_path)
        
        if not structure:
            return None
        
        # Step 2: Load image
        image = np.array(Image.open(image_path))
        
        # Step 3: Extract text from each cell
        cells = []
        for box, label, score in zip(
            structure['boxes'],
            structure['labels'],
            structure['scores']
        ):
            if label in [3, 4, 5]:  # Cell-like elements
                x1, y1, x2, y2 = map(int, box)
                
                # Crop cell
                cell_img = image[y1:y2, x1:x2]
                
                # OCR
                try:
                    ocr_result = self.ocr.ocr(cell_img, cls=True)
                    text = ' '.join([
                        line[1][0] for line in ocr_result[0]
                    ]) if ocr_result[0] else ''
                except:
                    text = ''
                
                cells.append({
                    'bbox': [x1, y1, x2, y2],
                    'text': text,
                    'confidence': float(score)
                })
        
        return {
            'cells': cells,
            'structure': structure
        }
    
    def cells_to_dataframe(self, cells):
        """Convert cells to pandas DataFrame"""
        import pandas as pd
        
        if not cells:
            return pd.DataFrame()
        
        # Sort cells by position (top to bottom, left to right)
        cells_sorted = sorted(cells, key=lambda c: (c['bbox'][1], c['bbox'][0]))
        
        # Group into rows (cells with similar y-coordinates)
        rows = []
        current_row = []
        current_y = cells_sorted[0]['bbox'][1]
        threshold = 20  # pixels
        
        for cell in cells_sorted:
            if abs(cell['bbox'][1] - current_y) < threshold:
                current_row.append(cell)
            else:
                rows.append(sorted(current_row, key=lambda c: c['bbox'][0]))
                current_row = [cell]
                current_y = cell['bbox'][1]
        
        if current_row:
            rows.append(sorted(current_row, key=lambda c: c['bbox'][0]))
        
        # Convert to 2D array
        table_data = [[cell['text'] for cell in row] for row in rows]
        
        return pd.DataFrame(table_data)

# Usage
if __name__ == '__main__':
    extractor = CompletTableExtractor()
    
    result = extractor.extract_complete_table('financial_table.jpg')
    
    if result:
        df = extractor.cells_to_dataframe(result['cells'])
        print(df)
        df.to_csv('output.csv', index=False)
```

---

## Amazon Textract Implementation

### Basic Table Extraction

```python
#!/usr/bin/env python3
"""
Amazon Textract Table Extraction
"""

import boto3
from botocore.exceptions import ClientError

class TextractTableExtractor:
    def __init__(self, region_name='us-east-1'):
        """
        Initialize Textract client
        
        Args:
            region_name: AWS region
        """
        self.textract = boto3.client('textract', region_name=region_name)
    
    def extract_table(self, image_path):
        """
        Extract table from image using Textract
        
        Args:
            image_path: Path to image file
            
        Returns:
            List of tables with structured data
        """
        # Read image
        with open(image_path, 'rb') as image_file:
            image_bytes = image_file.read()
        
        try:
            # Call Textract
            response = self.textract.analyze_document(
                Document={'Bytes': image_bytes},
                FeatureTypes=['TABLES']
            )
            
            # Extract tables
            tables = self._parse_tables(response)
            
            return tables
        
        except ClientError as e:
            print(f"Error: {e}")
            return None
    
    def _parse_tables(self, response):
        """Parse Textract response into structured tables"""
        blocks = response['Blocks']
        
        # Build block map
        block_map = {block['Id']: block for block in blocks}
        
        # Find table blocks
        tables = []
        for block in blocks:
            if block['BlockType'] == 'TABLE':
                table = self._extract_table_data(block, block_map)
                tables.append(table)
        
        return tables
    
    def _extract_table_data(self, table_block, block_map):
        """Extract data from a single table"""
        rows = {}
        
        if 'Relationships' not in table_block:
            return {'rows': []}
        
        for relationship in table_block['Relationships']:
            if relationship['Type'] == 'CHILD':
                for cell_id in relationship['Ids']:
                    cell = block_map[cell_id]
                    if cell['BlockType'] == 'CELL':
                        row_index = cell['RowIndex']
                        col_index = cell['ColumnIndex']
                        
                        if row_index not in rows:
                            rows[row_index] = {}
                        
                        # Get cell text
                        cell_text = self._get_cell_text(cell, block_map)
                        confidence = cell.get('Confidence', 0)
                        
                        rows[row_index][col_index] = {
                            'text': cell_text,
                            'confidence': confidence
                        }
        
        # Convert to list format
        table_data = []
        for row_index in sorted(rows.keys()):
            row_data = []
            for col_index in sorted(rows[row_index].keys()):
                row_data.append(rows[row_index][col_index]['text'])
            table_data.append(row_data)
        
        return {
            'rows': table_data,
            'row_count': len(table_data),
            'column_count': len(table_data[0]) if table_data else 0
        }
    
    def _get_cell_text(self, cell, block_map):
        """Extract text from a cell"""
        text = ''
        if 'Relationships' in cell:
            for relationship in cell['Relationships']:
                if relationship['Type'] == 'CHILD':
                    for child_id in relationship['Ids']:
                        word = block_map[child_id]
                        if word['BlockType'] == 'WORD':
                            text += word['Text'] + ' '
        return text.strip()
    
    def save_to_csv(self, tables, output_path):
        """Save tables to CSV file"""
        import csv
        
        with open(output_path, 'w', newline='', encoding='utf-8') as f:
            writer = csv.writer(f)
            
            for idx, table in enumerate(tables):
                if idx > 0:
                    writer.writerow([])  # Blank line between tables
                
                writer.writerow([f"Table {idx + 1}"])
                
                for row in table['rows']:
                    writer.writerow(row)

# Usage
if __name__ == '__main__':
    extractor = TextractTableExtractor()
    
    tables = extractor.extract_table('invoice.pdf')
    
    if tables:
        print(f"Extracted {len(tables)} tables")
        for i, table in enumerate(tables):
            print(f"Table {i+1}: {table['row_count']} rows × {table['column_count']} columns")
        
        extractor.save_to_csv(tables, 'output.csv')
```

---

## Tesseract + OpenCV Implementation

### Complete Pipeline

```python
#!/usr/bin/env python3
"""
Tesseract + OpenCV Table Extraction
"""

import cv2
import pytesseract
import numpy as np
from pytesseract import Output

class TesseractTableExtractor:
    def __init__(self):
        # Configure Tesseract (adjust path if needed)
        # pytesseract.pytesseract.tesseract_cmd = r'C:\Program Files\Tesseract-OCR\tesseract.exe'
        pass
    
    def extract_table(self, image_path):
        """
        Extract table using Tesseract and OpenCV
        
        Args:
            image_path: Path to image file
            
        Returns:
            List of rows, each containing list of cell texts
        """
        # Read image
        img = cv2.imread(image_path)
        
        # Preprocess
        processed = self.preprocess_image(img)
        
        # Detect table structure
        cells = self.detect_cells(processed, img.shape)
        
        # OCR each cell
        table_data = self.ocr_cells(img, cells)
        
        return table_data
    
    def preprocess_image(self, img):
        """Preprocess image for better OCR"""
        # Convert to grayscale
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        
        # Increase contrast
        clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8,8))
        enhanced = clahe.apply(gray)
        
        # Denoise
        denoised = cv2.fastNlMeansDenoising(enhanced, h=10)
        
        # Threshold
        thresh = cv2.threshold(
            denoised, 0, 255, 
            cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU
        )[1]
        
        return thresh
    
    def detect_cells(self, thresh, original_shape):
        """Detect table cells using morphological operations"""
        # Detect horizontal lines
        horizontal_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (40, 1))
        horizontal = cv2.morphologyEx(thresh, cv2.MORPH_OPEN, horizontal_kernel)
        
        # Detect vertical lines
        vertical_kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (1, 40))
        vertical = cv2.morphologyEx(thresh, cv2.MORPH_OPEN, vertical_kernel)
        
        # Combine
        table_mask = cv2.add(horizontal, vertical)
        
        # Find contours
        contours, _ = cv2.findContours(
            table_mask, cv2.RETR_TREE, cv2.CHAIN_APPROX_SIMPLE
        )
        
        # Filter and sort cells
        cells = []
        for contour in contours:
            x, y, w, h = cv2.boundingRect(contour)
            
            # Filter noise (too small cells)
            if w > 30 and h > 15 and w < original_shape[1] * 0.9:
                cells.append({
                    'x': x, 'y': y, 'w': w, 'h': h
                })
        
        # Sort cells: top to bottom, left to right
        cells = sorted(cells, key=lambda c: (c['y'], c['x']))
        
        return cells
    
    def ocr_cells(self, img, cells):
        """Perform OCR on each cell"""
        # Group cells into rows
        rows = self._group_into_rows(cells)
        
        # OCR each cell
        table_data = []
        for row in rows:
            row_data = []
            for cell in row:
                x, y, w, h = cell['x'], cell['y'], cell['w'], cell['h']
                
                # Add padding
                padding = 2
                x = max(0, x + padding)
                y = max(0, y + padding)
                w = max(0, w - 2*padding)
                h = max(0, h - 2*padding)
                
                # Extract cell image
                cell_img = img[y:y+h, x:x+w]
                
                # OCR
                text = pytesseract.image_to_string(
                    cell_img,
                    config='--psm 6'  # Assume single uniform block of text
                ).strip()
                
                row_data.append(text)
            
            table_data.append(row_data)
        
        return table_data
    
    def _group_into_rows(self, cells, y_threshold=20):
        """Group cells into rows based on y-coordinates"""
        if not cells:
            return []
        
        rows = []
        current_row = [cells[0]]
        current_y = cells[0]['y']
        
        for cell in cells[1:]:
            if abs(cell['y'] - current_y) < y_threshold:
                current_row.append(cell)
            else:
                rows.append(sorted(current_row, key=lambda c: c['x']))
                current_row = [cell]
                current_y = cell['y']
        
        if current_row:
            rows.append(sorted(current_row, key=lambda c: c['x']))
        
        return rows
    
    def save_to_csv(self, table_data, output_path):
        """Save table to CSV"""
        import csv
        
        with open(output_path, 'w', newline='', encoding='utf-8') as f:
            writer = csv.writer(f)
            writer.writerows(table_data)

# Usage
if __name__ == '__main__':
    extractor = TesseractTableExtractor()
    
    table = extractor.extract_table('table.jpg')
    
    print("Extracted table:")
    for row in table:
        print(row)
    
    extractor.save_to_csv(table, 'output.csv')
```

---

## Complete Production Pipeline

### Robust Multi-Model Pipeline

```python
#!/usr/bin/env python3
"""
Production-Ready Table Extraction Pipeline
with fallback and validation
"""

import logging
from enum import Enum
from dataclasses import dataclass
from typing import List, Dict, Optional
import time

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

class ModelType(Enum):
    PADDLEOCR = "paddleocr"
    TABLE_TRANSFORMER = "table_transformer"
    TEXTRACT = "textract"
    TESSERACT = "tesseract"

@dataclass
class ExtractionResult:
    """Represents table extraction result"""
    success: bool
    tables: List[Dict]
    model_used: ModelType
    processing_time: float
    confidence: float
    error_message: Optional[str] = None

class ProductionTableExtractor:
    def __init__(self, preferred_models=None):
        """
        Initialize with model preferences
        
        Args:
            preferred_models: List of ModelType in order of preference
        """
        self.preferred_models = preferred_models or [
            ModelType.PADDLEOCR,
            ModelType.TABLE_TRANSFORMER,
            ModelType.TESSERACT
        ]
        
        self.models = {}
        self._initialize_models()
    
    def _initialize_models(self):
        """Initialize available models"""
        # Try to initialize PaddleOCR
        try:
            from paddleocr import PPStructure
            self.models[ModelType.PADDLEOCR] = PPStructure(
                table=True, ocr=True, show_log=False
            )
            logger.info("PaddleOCR initialized successfully")
        except Exception as e:
            logger.warning(f"Failed to initialize PaddleOCR: {e}")
        
        # Try to initialize Tesseract
        try:
            import pytesseract
            pytesseract.get_tesseract_version()
            self.models[ModelType.TESSERACT] = TesseractTableExtractor()
            logger.info("Tesseract initialized successfully")
        except Exception as e:
            logger.warning(f"Failed to initialize Tesseract: {e}")
        
        # Add other models as needed
        
        if not self.models:
            raise RuntimeError("No OCR models available")
    
    def extract_table(self, image_path, retry=True) -> ExtractionResult:
        """
        Extract table with automatic fallback
        
        Args:
            image_path: Path to image
            retry: Whether to try fallback models if primary fails
            
        Returns:
            ExtractionResult with table data
        """
        for model_type in self.preferred_models:
            if model_type not in self.models:
                continue
            
            try:
                logger.info(f"Attempting extraction with {model_type.value}")
                start_time = time.time()
                
                result = self._extract_with_model(image_path, model_type)
                
                processing_time = time.time() - start_time
                
                # Validate result
                if self._validate_result(result):
                    logger.info(
                        f"Successfully extracted with {model_type.value} "
                        f"in {processing_time:.2f}s"
                    )
                    return ExtractionResult(
                        success=True,
                        tables=result,
                        model_used=model_type,
                        processing_time=processing_time,
                        confidence=self._calculate_confidence(result)
                    )
                else:
                    logger.warning(f"{model_type.value} result failed validation")
                    if not retry:
                        break
            
            except Exception as e:
                logger.error(f"{model_type.value} failed: {str(e)}")
                if not retry:
                    break
        
        # All models failed
        return ExtractionResult(
            success=False,
            tables=[],
            model_used=None,
            processing_time=0,
            confidence=0.0,
            error_message="All extraction models failed"
        )
    
    def _extract_with_model(self, image_path, model_type):
        """Extract using specific model"""
        if model_type == ModelType.PADDLEOCR:
            from PIL import Image
            img = Image.open(image_path)
            result = self.models[model_type](img)
            return [
                {
                    'html': item['res'].get('html', ''),
                    'bbox': item['bbox']
                }
                for item in result if item['type'] == 'table'
            ]
        
        elif model_type == ModelType.TESSERACT:
            table_data = self.models[model_type].extract_table(image_path)
            return [{'data': table_data}]
        
        # Add other model implementations
        
        return []
    
    def _validate_result(self, result):
        """Validate extraction result"""
        if not result:
            return False
        
        # Check if tables are not empty
        for table in result:
            if 'html' in table and len(table['html']) > 50:
                return True
            if 'data' in table and len(table['data']) > 0:
                return True
        
        return False
    
    def _calculate_confidence(self, result):
        """Calculate confidence score"""
        # Simple heuristic: more data = higher confidence
        if not result:
            return 0.0
        
        total_content = 0
        for table in result:
            if 'html' in table:
                total_content += len(table['html'])
            elif 'data' in table:
                total_content += sum(len(str(cell)) for row in table['data'] for cell in row)
        
        # Normalize to 0-1 range
        return min(1.0, total_content / 1000)

# Usage
if __name__ == '__main__':
    extractor = ProductionTableExtractor()
    
    result = extractor.extract_table('document.jpg')
    
    if result.success:
        print(f"Success! Used {result.model_used.value}")
        print(f"Processing time: {result.processing_time:.2f}s")
        print(f"Confidence: {result.confidence:.2%}")
        print(f"Found {len(result.tables)} tables")
    else:
        print(f"Failed: {result.error_message}")
```

---

## AutoHotkey Integration

### Calling Python OCR from AutoHotkey

```autohotkey
; AutoHotkey v2 - Python OCR Integration
#Requires AutoHotkey v2.0

; Configuration
global PYTHON_PATH := "python"  ; or full path to python.exe
global OCR_SCRIPT := A_ScriptDir . "\ocr_extractor.py"

/**
 * Extract table from image using Python OCR
 * 
 * @param imagePath Full path to image file
 * @param outputPath Full path for output CSV
 * @return Object with success status and data
 */
ExtractTable(imagePath, outputPath) {
    ; Build command
    cmd := Format('"{}" "{}" "{}" "{}"', 
        PYTHON_PATH, OCR_SCRIPT, imagePath, outputPath)
    
    ; Execute
    result := RunCommand(cmd)
    
    ; Parse result
    if result.exitCode = 0 {
        return {
            success: true,
            outputFile: outputPath,
            stdout: result.stdout
        }
    } else {
        return {
            success: false,
            error: result.stderr
        }
    }
}

/**
 * Run command and capture output
 */
RunCommand(command) {
    shell := ComObject("WScript.Shell")
    exec := shell.Exec(ComSpec . " /c " . command)
    
    ; Wait for completion
    while !exec.Status
        Sleep 100
    
    return {
        exitCode: exec.ExitCode,
        stdout: exec.StdOut.ReadAll(),
        stderr: exec.StdErr.ReadAll()
    }
}

/**
 * Batch process multiple images
 */
BatchExtractTables(inputDir, outputDir) {
    ; Create output directory
    if !DirExist(outputDir)
        DirCreate(outputDir)
    
    ; Find all images
    images := []
    Loop Files, inputDir . "\*.{jpg,png}", "F" {
        images.Push(A_LoopFileFullPath)
    }
    
    ; Process each
    results := []
    progress := 0
    total := images.Length
    
    for index, imagePath in images {
        progress := index / total * 100
        ToolTip("Processing: " . progress . "%")
        
        ; Generate output path
        SplitPath(imagePath, &fileName)
        outputPath := outputDir . "\" . StrReplace(fileName, ".jpg", ".csv")
        
        ; Extract
        result := ExtractTable(imagePath, outputPath)
        results.Push({
            image: imagePath,
            success: result.success,
            output: result.has("outputFile") ? result.outputFile : ""
        })
    }
    
    ToolTip()
    return results
}

/**
 * Example: Extract with GUI
 */
ShowOCRGui() {
    gui := Gui("+Resize", "Table OCR Extractor")
    
    ; Input section
    gui.Add("Text", "x10 y10", "Image File:")
    editImage := gui.Add("Edit", "x10 y30 w400", "")
    btnBrowse := gui.Add("Button", "x420 y28 w80", "Browse...")
    btnBrowse.OnEvent("Click", (*) => BrowseForImage(editImage))
    
    ; Output section
    gui.Add("Text", "x10 y70", "Output CSV:")
    editOutput := gui.Add("Edit", "x10 y90 w400", "")
    
    ; Extract button
    btnExtract := gui.Add("Button", "x10 y130 w100", "Extract Table")
    btnExtract.OnEvent("Click", (*) => DoExtract(editImage, editOutput))
    
    ; Status
    global statusText := gui.Add("Text", "x10 y170 w480", "Ready")
    
    gui.Show("w500 h200")
}

BrowseForImage(editControl) {
    file := FileSelect(1, "", "Select Image", "Images (*.jpg; *.png)")
    if file
        editControl.Value := file
}

DoExtract(editImage, editOutput) {
    imagePath := editImage.Value
    outputPath := editOutput.Value
    
    if !imagePath || !outputPath {
        MsgBox("Please specify both input and output files")
        return
    }
    
    statusText.Value := "Processing..."
    
    ; Extract
    result := ExtractTable(imagePath, outputPath)
    
    if result.success {
        statusText.Value := "Success! Saved to: " . result.outputFile
        MsgBox("Table extracted successfully!`n`nOutput: " . result.outputFile, "Success")
    } else {
        statusText.Value := "Failed: " . result.error
        MsgBox("Extraction failed:`n" . result.error, "Error")
    }
}

; Run GUI
ShowOCRGui()
```

---

## Troubleshooting Guide

### Common Issues and Solutions

#### 1. PaddleOCR Installation Issues

**Problem**: Import error or model download failures

**Solution**:
```bash
# Uninstall and reinstall
pip uninstall paddleocr paddlepaddle -y
pip install paddleocr paddlepaddle --no-cache-dir

# If on Windows with GPU
pip install paddlepaddle-gpu

# Test
python -c "from paddleocr import PaddleOCR; print('OK')"
```

#### 2. Tesseract Not Found

**Problem**: `pytesseract.pytesseract.TesseractNotFoundError`

**Solution**:
```python
# Set path explicitly
import pytesseract
pytesseract.pytesseract.tesseract_cmd = r'C:\Program Files\Tesseract-OCR\tesseract.exe'

# Or add to PATH environment variable
```

#### 3. Low Accuracy Results

**Problem**: OCR returning gibberish or missing text

**Solution**:
```python
def enhance_image_quality(img):
    """Improve image for better OCR"""
    # 1. Increase resolution if too small
    h, w = img.shape[:2]
    if w < 1000:
        scale = 1000 / w
        img = cv2.resize(img, None, fx=scale, fy=scale, 
                        interpolation=cv2.INTER_CUBIC)
    
    # 2. Convert to grayscale
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    
    # 3. Denoise
    denoised = cv2.fastNlMeansDenoising(gray)
    
    # 4. Increase contrast
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8,8))
    enhanced = clahe.apply(denoised)
    
    # 5. Sharpen
    kernel = np.array([[-1,-1,-1], [-1,9,-1], [-1,-1,-1]])
    sharpened = cv2.filter2D(enhanced, -1, kernel)
    
    return sharpened
```

#### 4. Memory Issues with Large Batches

**Problem**: Out of memory errors

**Solution**:
```python
# Process in smaller batches
def process_large_batch(image_files, batch_size=10):
    for i in range(0, len(image_files), batch_size):
        batch = image_files[i:i+batch_size]
        process_batch(batch)
        
        # Clean up
        import gc
        gc.collect()
        
        # Optional: clear GPU memory
        if torch.cuda.is_available():
            torch.cuda.empty_cache()
```

#### 5. Slow Processing Speed

**Problem**: Takes too long per image

**Solution**:
```python
# Use multiprocessing
from multiprocessing import Pool

def parallel_extract(image_paths, num_workers=4):
    with Pool(num_workers) as pool:
        results = pool.map(extract_table, image_paths)
    return results
```

---

**Document Version**: 1.0  
**Last Updated**: December 2024  
**Related Docs**: OCR_MODELS_RESEARCH.md, OCR_DECISION_GUIDE.md
