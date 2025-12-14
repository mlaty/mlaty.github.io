class OCRTool {
    constructor() {
        this.files = [];
        this.currentFileIndex = 0;
        this.recognizedTexts = [];
        this.isProcessing = false;
        this.paddleOCRInitialized = false;
        
        this.initializeElements();
        this.bindEvents();
        // PaddleOCR initialization is now handled in HTML module script
    }

    initializeElements() {
        this.fileInput = document.getElementById('fileInput');
        this.uploadArea = document.getElementById('uploadArea');
        this.uploadButton = document.getElementById('uploadButton');
        this.imagePreview = document.getElementById('imagePreview');
        this.processBtn = document.getElementById('processBtn');
        this.progressBar = document.getElementById('progressBar');
        this.progressFill = document.querySelector('.progress-fill');
        this.progressText = document.querySelector('.progress-text');
        this.resultText = document.getElementById('resultText');
        this.copyBtn = document.getElementById('copyBtn');
        this.uploadModeInputs = document.querySelectorAll('input[name="uploadMode"]');
        this.recognitionModeInputs = document.querySelectorAll('input[name="recognitionMode"]');
        this.ocrEngineInputs = document.querySelectorAll('input[name="ocrEngine"]');
        
    }

    bindEvents() {
        // File input change
        this.fileInput.addEventListener('change', (e) => this.handleFileSelect(e));
        
        // Drag and drop
        this.uploadArea.addEventListener('dragover', (e) => this.handleDragOver(e));
        this.uploadArea.addEventListener('dragleave', (e) => this.handleDragLeave(e));
        this.uploadArea.addEventListener('drop', (e) => this.handleDrop(e));
        
        // Upload button click - Safari compatible
        this.uploadButton.addEventListener('click', (e) => {
            e.preventDefault();
            this.fileInput.click();
        });
        
        // Process button
        this.processBtn.addEventListener('click', () => this.startOCRProcess());
        
        // Copy button
        this.copyBtn.addEventListener('click', () => this.copyToClipboard());
        
        // Upload mode change
        this.uploadModeInputs.forEach(input => {
            input.addEventListener('change', () => this.handleUploadModeChange());
        });
        
        // Recognition mode change
        this.recognitionModeInputs.forEach(input => {
            input.addEventListener('change', () => this.handleRecognitionModeChange());
        });
        
        // Paste image functionality
        document.addEventListener('paste', (e) => this.handlePaste(e));
    }
    
    // PaddleOCR initialization is now handled in the HTML module script

    handleFileSelect(e) {
        const uploadMode = document.querySelector('input[name="uploadMode"]:checked').value;
        const shouldAppend = uploadMode === 'batch' && this.files.length > 0;
        
        this.processFiles(e.target.files, shouldAppend);
    }

    handleDragOver(e) {
        e.preventDefault();
        this.uploadArea.classList.add('dragover');
    }

    handleDragLeave(e) {
        e.preventDefault();
        e.stopPropagation();
        // Only remove dragover if leaving the upload area completely
        if (!this.uploadArea.contains(e.relatedTarget)) {
            this.uploadArea.classList.remove('dragover');
        }
    }

    handleDrop(e) {
        e.preventDefault();
        this.uploadArea.classList.remove('dragover');
        
        const uploadMode = document.querySelector('input[name="uploadMode"]:checked').value;
        const shouldAppend = uploadMode === 'batch' && this.files.length > 0;
        
        this.processFiles(e.dataTransfer.files, shouldAppend);
    }

    processFiles(fileList, isAppend = false) {
        const validFiles = Array.from(fileList).filter(file => {
            // Safari sometimes doesn't set file.type correctly, so also check file extension
            const isValidType = file.type === 'image/jpeg' || file.type === 'image/jpg' || file.type === 'image/png';
            const hasValidExtension = /\.(jpe?g|png)$/i.test(file.name);
            return isValidType || hasValidExtension;
        });

        if (validFiles.length === 0) {
            alert('請選擇有效的 JPG 或 PNG 圖片檔案');
            return;
        }

        if (isAppend) {
            this.files = [...this.files, ...validFiles];
        } else {
            this.files = validFiles;
        }
        
        this.displayImagePreviews();
        this.processBtn.disabled = false;
    }

    displayImagePreviews() {
        this.imagePreview.innerHTML = '';
        
        this.files.forEach((file, index) => {
            const previewItem = document.createElement('div');
            previewItem.className = 'preview-item';
            
            const img = document.createElement('img');
            img.src = URL.createObjectURL(file);
            
            const filename = document.createElement('div');
            filename.className = 'filename';
            filename.textContent = file.name;
            
            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'delete-btn';
            deleteBtn.innerHTML = '×';
            deleteBtn.title = '刪除此圖片';
            deleteBtn.onclick = (e) => {
                e.stopPropagation();
                this.deleteFile(index);
            };
            
            previewItem.appendChild(img);
            previewItem.appendChild(filename);
            previewItem.appendChild(deleteBtn);
            this.imagePreview.appendChild(previewItem);
        });
    }
    
    deleteFile(index) {
        // Remove file from array
        this.files.splice(index, 1);
        
        // Update preview
        this.displayImagePreviews();
        
        // Disable process button if no files
        if (this.files.length === 0) {
            this.processBtn.disabled = true;
            this.resultText.value = '';
            this.copyBtn.disabled = true;
        }
    }

    async startOCRProcess() {
        if (this.isProcessing) return;
        
        this.isProcessing = true;
        this.processBtn.disabled = true;
        this.copyBtn.disabled = true;
        this.resultText.value = '';
        this.recognizedTexts = [];
        
        this.showProgressBar();
        
        const uploadMode = document.querySelector('input[name="uploadMode"]:checked').value;
        
        try {
            for (let i = 0; i < this.files.length; i++) {
                this.currentFileIndex = i;
                this.updateProgress((i / this.files.length) * 100, `正在處理第 ${i + 1} 張圖片...`);
                
                const text = await this.processImage(this.files[i]);
                this.recognizedTexts.push(text);
                
                // Update result display progressively
                this.updateResultDisplay(uploadMode);
            }
            
            this.updateProgress(100, '辨識完成！');
            
        } catch (error) {
            console.error('OCR Error:', error);
            alert('辨識過程中發生錯誤，請重試');
        } finally {
            this.isProcessing = false;
            this.processBtn.disabled = false;
            this.copyBtn.disabled = false;
            this.hideProgressBar();
        }
    }

    async processImage(file) {
        try {
            const ocrEngine = document.querySelector('input[name="ocrEngine"]:checked').value;
            
            console.log(`Processing with engine: ${ocrEngine}, PaddleOCR ready: ${window.paddleOCRInitialized}`);
            
            if (ocrEngine === 'paddleocr') {
                if (window.paddleOCRInitialized && window.paddleOCR) {
                    console.log('Using PaddleOCR for processing');
                    return await this.processPaddleOCR(file);
                } else if (window.mockPaddleOCR) {
                    console.log('Using mock PaddleOCR for demo');
                    return await this.processMockPaddleOCR(file);
                } else {
                    console.log('PaddleOCR not ready, falling back to Tesseract');
                    this.updateProgress(
                        (this.currentFileIndex / this.files.length) * 100,
                        'PaddleOCR 未就緒，使用 Tesseract...'
                    );
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    return await this.processTesseractOCR(file);
                }
            } else {
                console.log('Using Tesseract for processing');
                return await this.processTesseractOCR(file);
            }

        } catch (error) {
            console.error('Error processing image:', error);
            return `辨識失敗: ${file.name} (${error.message})`;
        }
    }
    
    async processTesseractOCR(file) {
        // Detect language automatically
        const languages = await this.detectLanguage(file);
        
        // Perform OCR with detected languages
        const result = await Tesseract.recognize(file, languages, {
            logger: m => {
                if (m.status === 'recognizing text') {
                    const progress = Math.floor(m.progress * 100);
                    this.updateProgress(
                        (this.currentFileIndex / this.files.length) * 100 + (progress / this.files.length),
                        `Tesseract 辨識中... ${progress}%`
                    );
                }
            }
        });

        // Process the recognized text to preserve layout
        return this.processRecognizedText(result.data);
    }
    
    async processPaddleOCR(file) {
        this.updateProgress(
            (this.currentFileIndex / this.files.length) * 100 + (25 / this.files.length),
            `PaddleOCR 載入圖片中...`
        );
        
        try {
            // Create image element for PaddleJS
            const imgElement = await this.createImageElement(file);
            
            this.updateProgress(
                (this.currentFileIndex / this.files.length) * 100 + (50 / this.files.length),
                `PaddleOCR 辨識中...`
            );
            
            // Use PaddleJS OCR for recognition
            const result = await window.paddleOCR.recognize(imgElement);
            
            this.updateProgress(
                (this.currentFileIndex / this.files.length) * 100 + (75 / this.files.length),
                `PaddleOCR 處理結果中...`
            );
            
            console.log('PaddleJS OCR result:', result);
            
            // Convert PaddleJS result to our format
            const processedData = this.convertPaddleOCRResult(result);
            
            // Process the recognized text
            return this.processRecognizedText(processedData);
            
        } catch (error) {
            console.error('PaddleJS processing error:', error);
            throw new Error(`PaddleOCR 處理失敗: ${error.message}`);
        }
    }
    
    async processMockPaddleOCR(file) {
        this.updateProgress(
            (this.currentFileIndex / this.files.length) * 100 + (25 / this.files.length),
            `模擬 PaddleOCR 處理中...`
        );
        
        try {
            // Create image element for mock processing
            const imgElement = await this.createImageElement(file);
            
            this.updateProgress(
                (this.currentFileIndex / this.files.length) * 100 + (50 / this.files.length),
                `模擬辨識中...`
            );
            
            // Use mock PaddleOCR
            const result = await window.mockPaddleOCR.recognize(imgElement);
            
            this.updateProgress(
                (this.currentFileIndex / this.files.length) * 100 + (75 / this.files.length),
                `處理模擬結果...`
            );
            
            console.log('Mock PaddleOCR result:', result);
            
            // Return formatted text directly
            return result.text || '模擬辨識結果：此為 PaddleOCR 演示版本';
            
        } catch (error) {
            console.error('Mock PaddleOCR error:', error);
            throw new Error(`模擬 PaddleOCR 處理失敗: ${error.message}`);
        }
    }
    
    createImageElement(file) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            const url = URL.createObjectURL(file);
            
            img.onload = () => {
                URL.revokeObjectURL(url);
                resolve(img);
            };
            
            img.onerror = () => {
                URL.revokeObjectURL(url);
                reject(new Error('無法載入圖片'));
            };
            
            img.src = url;
        });
    }
    
    fileToDataURL(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = e => resolve(e.target.result);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }
    
    convertPaddleOCRResult(paddleResult) {
        // Handle both PaddleJS format and array format
        let textItems = [];
        
        if (paddleResult && paddleResult.text && paddleResult.points) {
            // PaddleJS format: {text: "combined text", points: [...]}
            const textLines = paddleResult.text.split('\n');
            const points = paddleResult.points || [];
            
            textItems = textLines.map((text, index) => ({
                text: text.trim(),
                box: points[index] || [[0, index * 30], [200, index * 30], [200, (index + 1) * 30], [0, (index + 1) * 30]],
                score: 0.95
            })).filter(item => item.text.length > 0);
            
        } else if (Array.isArray(paddleResult)) {
            // Array format: [{text: "...", box: [...], score: ...}, ...]
            textItems = paddleResult;
        } else {
            // Fallback for other formats
            console.warn('Unknown PaddleOCR result format:', paddleResult);
            return {
                text: '',
                words: [],
                paragraphs: [],
                lines: []
            };
        }
        
        // Convert to Tesseract-like format
        const words = [];
        const lines = [];
        let allText = '';
        
        textItems.forEach((item, index) => {
            const text = item.text || '';
            const box = item.box || [[0, 0], [100, 0], [100, 30], [0, 30]];
            
            if (text.trim().length === 0) return;
            
            // Create word object similar to Tesseract format
            const word = {
                text: text,
                bbox: {
                    x0: Math.min(...box.map(p => p[0])),
                    y0: Math.min(...box.map(p => p[1])),
                    x1: Math.max(...box.map(p => p[0])),
                    y1: Math.max(...box.map(p => p[1]))
                },
                confidence: item.score || 0.95
            };
            
            words.push(word);
            lines.push({ text: text });
            allText += text + ' ';
        });
        
        // Create a paragraph containing all text
        const paragraphs = [{
            text: allText.trim()
        }];
        
        return {
            text: allText.trim(),
            words: words,
            paragraphs: paragraphs,
            lines: lines
        };
    }

    async detectLanguage(file) {
        try {
            // Try to detect with mixed Chinese and English first
            const quickResult = await Tesseract.recognize(file, 'chi_tra+eng', {
                logger: () => {} // Silent mode for language detection
            });
            
            const text = quickResult.data.text;
            const chineseChars = (text.match(/[\u4e00-\u9fff]/g) || []).length;
            const englishChars = (text.match(/[a-zA-Z]/g) || []).length;
            const totalChars = chineseChars + englishChars;
            
            if (totalChars === 0) {
                return 'chi_tra+eng'; // Default fallback
            }
            
            const chineseRatio = chineseChars / totalChars;
            
            if (chineseRatio > 0.7) {
                return 'chi_tra';
            } else if (chineseRatio < 0.3) {
                return 'eng';
            } else {
                return 'chi_tra+eng';
            }
            
        } catch (error) {
            console.error('Language detection error:', error);
            return 'chi_tra+eng'; // Default fallback
        }
    }

    processRecognizedText(data) {
        // Get user's recognition mode preference
        const recognitionMode = document.querySelector('input[name="recognitionMode"]:checked').value;
        let processedText = '';
        
        switch (recognitionMode) {
            case 'text':
                // Force text mode - always single line
                processedText = this.formatAsText(data);
                break;
                
            case 'table':
                // Force table mode - always preserve table format
                processedText = this.formatAsTable(data.words || []);
                break;
                
            case 'auto':
            default:
                // Auto detection (original logic)
                const words = data.words;
                if (this.looksLikeTable(words)) {
                    processedText = this.formatAsTable(words);
                } else {
                    processedText = this.formatAsText(data);
                }
                break;
        }
        
        return processedText;
    }

    looksLikeTable(words) {
        // More conservative table detection logic
        const lines = this.groupWordsByLines(words);
        if (lines.length < 3) return false; // Need at least 3 rows for a real table
        
        // Filter out table border characters for analysis
        const filteredWords = words.filter(word => {
            const text = word.text.trim();
            return text !== '|' && text !== '-' && text !== '+' && text !== '=' && text !== '_' && 
                   !/^[\|\-\+\=\_\s]+$/.test(text) && text.length > 0;
        });
        
        const filteredLines = this.groupWordsByLines(filteredWords);
        if (filteredLines.length < 3) return false;
        
        // Check if there are consistent column alignments
        const columnCounts = filteredLines.map(line => line.length);
        const avgColumns = columnCounts.reduce((a, b) => a + b, 0) / columnCounts.length;
        
        // Stricter criteria for table detection:
        // 1. Must have at least 2.5 columns on average (to avoid two-column text)
        // 2. At least 70% of lines must have similar column count
        // 3. Must have clear column separation
        if (avgColumns < 2.5) return false;
        
        const similarColumnCountLines = columnCounts.filter(count => 
            Math.abs(count - avgColumns) <= 1
        );
        
        if (similarColumnCountLines.length / filteredLines.length < 0.7) return false;
        
        // Check for proper table structure
        const hasProperStructure = this.hasTableStructure(filteredLines);
        
        // Additional check: look for numeric data patterns (common in tables)
        const hasNumericData = this.hasNumericDataPattern(filteredLines);
        
        return hasProperStructure && hasNumericData;
    }
    
    hasNumericDataPattern(lines) {
        let numericCells = 0;
        let totalCells = 0;
        
        lines.forEach(line => {
            line.forEach(word => {
                const text = word.text.trim();
                totalCells++;
                // Check for numbers, percentages, decimals
                if (/\d/.test(text) || /%/.test(text) || /\d+\.\d+/.test(text)) {
                    numericCells++;
                }
            });
        });
        
        // At least 30% of cells should contain numeric data for it to be considered a table
        return totalCells > 0 && (numericCells / totalCells) >= 0.3;
    }
    
    hasTableStructure(lines) {
        if (lines.length < 2) return false;
        
        // Check if it's likely continuous text (long sequences)
        const allText = lines.map(line => line.map(word => word.text).join(' ')).join(' ');
        const totalWords = allText.split(' ').length;
        
        // If there are many words in a flowing manner, it's probably text, not a table
        if (totalWords > 20 && this.seemsLikeContinuousText(lines)) {
            return false;
        }
        
        // Check for column alignment
        let alignmentScore = 0;
        const tolerance = 30; // pixels
        
        for (let i = 1; i < lines.length; i++) {
            if (lines[i].length === lines[0].length) {
                let alignedColumns = 0;
                
                for (let j = 0; j < lines[0].length && j < lines[i].length; j++) {
                    const x1 = lines[0][j].bbox.x0;
                    const x2 = lines[i][j].bbox.x0;
                    
                    if (Math.abs(x1 - x2) <= tolerance) {
                        alignedColumns++;
                    }
                }
                
                if (alignedColumns / lines[0].length >= 0.5) {
                    alignmentScore++;
                }
            }
        }
        
        // At least 40% of lines should have proper alignment
        return alignmentScore / (lines.length - 1) >= 0.4;
    }
    
    seemsLikeContinuousText(lines) {
        // Check if words form continuous sentences
        const allWords = [];
        lines.forEach(line => {
            line.forEach(word => allWords.push(word.text));
        });
        
        const text = allWords.join(' ');
        
        // Signs of continuous text:
        // 1. Contains common connecting words
        // 2. Has proper sentence flow
        // 3. Words are not isolated values/numbers
        const connectingWords = ['the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by'];
        const hasConnectors = connectingWords.some(word => 
            text.toLowerCase().includes(' ' + word + ' ')
        );
        
        // Check if most words are complete words (not just numbers or single chars)
        const completeWords = allWords.filter(word => 
            word.length > 2 && !/^\d+$/.test(word)
        );
        
        return hasConnectors || (completeWords.length / allWords.length > 0.7);
    }

    groupWordsByLines(words) {
        if (words.length === 0) return [];
        
        // Sort words by Y position first
        const sortedWords = words.sort((a, b) => a.bbox.y0 - b.bbox.y0);
        
        const lines = [];
        let currentLine = [sortedWords[0]];
        let currentLineY = sortedWords[0].bbox.y0;
        
        for (let i = 1; i < sortedWords.length; i++) {
            const word = sortedWords[i];
            const wordY = word.bbox.y0;
            
            // Calculate the line height tolerance (more flexible for different fonts)
            const lineHeight = currentLine[0] ? (currentLine[0].bbox.y1 - currentLine[0].bbox.y0) : 20;
            const tolerance = Math.max(lineHeight * 0.5, 10);
            
            // If the Y distance is significant, start a new line
            if (Math.abs(wordY - currentLineY) > tolerance) {
                if (currentLine.length > 0) {
                    lines.push([...currentLine]);
                }
                currentLine = [word];
                currentLineY = wordY;
            } else {
                currentLine.push(word);
            }
        }
        
        // Don't forget the last line
        if (currentLine.length > 0) {
            lines.push(currentLine);
        }
        
        return lines;
    }

    formatAsTable(words) {
        // Filter out table border characters and lines more aggressively
        const filteredWords = words.filter(word => {
            const text = word.text.trim();
            
            // Check if it's purely table border characters
            if (!/[a-zA-Z0-9\u4e00-\u9fff%]/.test(text)) {
                // No letters, numbers, Chinese chars, or percentage signs
                return false;
            }
            
            // Remove pure border character words
            if (/^[\|\-\+\=\_\s]+$/.test(text)) {
                return false;
            }
            
            // Remove single border characters
            if (text.length === 1 && '|-+=_'.includes(text)) {
                return false;
            }
            
            return text.length > 0;
        });
        
        const lines = this.groupWordsByLines(filteredWords);
        let tableText = '';
        
        lines.forEach(line => {
            if (line.length === 0) return;
            
            // Group words into columns based on X position clusters
            const columns = this.groupWordsIntoColumns(line);
            
            // Format each column and fix decimal points
            const formattedColumns = columns.map(column => {
                const columnText = column.map(word => word.text).join('').trim();
                const fixedDecimal = this.fixDecimalPoints(columnText);
                const cleanedText = this.removeTableArtifacts(fixedDecimal);
                return cleanedText;
            });
            
            // Join columns with tabs
            const lineText = formattedColumns.filter(col => col.length > 0).join('\t');
            if (lineText.trim().length > 0) {
                tableText += lineText + '\n';
            }
        });
        
        return tableText.trim();
    }
    
    groupWordsIntoColumns(lineWords) {
        if (lineWords.length === 0) return [];
        
        // Sort words by X position
        const sortedWords = lineWords.sort((a, b) => a.bbox.x0 - b.bbox.x0);
        
        // Check if this might be a header row by analyzing text content
        const isHeaderRow = this.isLikelyHeaderRow(sortedWords);
        
        if (isHeaderRow) {
            // For header rows, try to keep related words together
            return this.groupHeaderWords(sortedWords);
        }
        
        // For data rows, use normal column grouping
        return this.groupDataWords(sortedWords);
    }
    
    isLikelyHeaderRow(words) {
        const allText = words.map(w => w.text).join('');
        
        // Check for header indicators
        const hasChineseWords = /[\u4e00-\u9fff]{2,}/.test(allText);
        const hasNumbers = /\d+%|\d+\.\d+/.test(allText);
        const hasYears = /20\d{2}/.test(allText);
        
        // If it has mostly Chinese characters and few numbers, likely a header
        // If it has years (like 2018, 2019), it might be header with year columns
        return hasChineseWords && (!hasNumbers || hasYears);
    }
    
    groupHeaderWords(sortedWords) {
        const columns = [];
        let currentColumn = [];
        
        // For headers, be more conservative about splitting
        for (let i = 0; i < sortedWords.length; i++) {
            const currentWord = sortedWords[i];
            
            if (i === 0) {
                currentColumn = [currentWord];
                continue;
            }
            
            const lastWord = sortedWords[i - 1];
            const gap = currentWord.bbox.x0 - lastWord.bbox.x1;
            
            // Check if current word looks like a year or separate header
            const currentText = currentWord.text.trim();
            const isYear = /^20\d{2}$/.test(currentText);
            const isStandaloneWord = currentText.length >= 2;
            
            // Average word width for reference
            const avgWordWidth = sortedWords.reduce((sum, w) => sum + (w.bbox.x1 - w.bbox.x0), 0) / sortedWords.length;
            
            // Split if:
            // 1. Gap is very large (more than 1.5x avg word width)
            // 2. Current word is a year and gap is significant
            // 3. Current word is standalone and gap is larger than average
            if (gap > avgWordWidth * 1.5 || 
                (isYear && gap > avgWordWidth * 0.8) ||
                (isStandaloneWord && gap > avgWordWidth)) {
                
                if (currentColumn.length > 0) {
                    columns.push(currentColumn);
                }
                currentColumn = [currentWord];
            } else {
                currentColumn.push(currentWord);
            }
        }
        
        if (currentColumn.length > 0) {
            columns.push(currentColumn);
        }
        
        return columns;
    }
    
    groupDataWords(sortedWords) {
        // Enhanced logic for data rows with better number handling
        const columns = [];
        let currentColumn = [sortedWords[0]];
        
        for (let i = 1; i < sortedWords.length; i++) {
            const currentWord = sortedWords[i];
            const lastWord = sortedWords[i - 1];
            
            // Calculate gap between words
            const gap = currentWord.bbox.x0 - lastWord.bbox.x1;
            const avgWordWidth = (lastWord.bbox.x1 - lastWord.bbox.x0);
            
            // Special handling for numbers and percentages
            const currentText = currentWord.text.trim();
            const lastText = lastWord.text.trim();
            
            // Check if this looks like a split number/percentage
            const isPartOfNumber = this.looksLikeNumberPart(lastText, currentText);
            
            // If gap is significant OR it's clearly a new column, start new column
            // But keep number parts together even with larger gaps
            if (gap > avgWordWidth * 0.5 && !isPartOfNumber) {
                columns.push(currentColumn);
                currentColumn = [currentWord];
            } else {
                currentColumn.push(currentWord);
            }
        }
        
        // Don't forget the last column
        if (currentColumn.length > 0) {
            columns.push(currentColumn);
        }
        
        return columns;
    }
    
    looksLikeNumberPart(firstText, secondText) {
        // Check if two text parts should be combined as a number
        
        // Case 1: first is number, second is decimal + percentage (like "58" + "3%")
        if (/^\d+$/.test(firstText) && /^\d+%$/.test(secondText)) {
            return true;
        }
        
        // Case 2: first is number, second is just a digit (like "58" + "3")
        if (/^\d+$/.test(firstText) && /^\d+$/.test(secondText) && secondText.length <= 2) {
            return true;
        }
        
        // Case 3: first ends with digit, second starts with percentage (like "58" + "%")
        if (/\d$/.test(firstText) && /^%/.test(secondText)) {
            return true;
        }
        
        // Case 4: decimal point was recognized separately (like "58" + "." + "3%")
        if (/^\d+$/.test(firstText) && /^[\.\,]/.test(secondText)) {
            return true;
        }
        
        return false;
    }
    
    fixDecimalPoints(text) {
        // Fix common OCR decimal point issues
        let fixedText = text;
        
        // Pattern 1: Three-digit percentages likely missing decimal point
        // 583% -> 58.3%, 249% -> 24.9%, 131% -> 13.1%, etc.
        fixedText = fixedText.replace(/(\d)(\d)(\d)(%)/g, (match, first, second, third, percent) => {
            const fullNumber = parseInt(first + second + third);
            // If it's a three-digit number > 100, likely missing decimal
            if (fullNumber > 100 && fullNumber < 1000) {
                return first + second + '.' + third + percent;
            }
            return match;
        });
        
        // Pattern 2: Two-digit numbers that might be missing decimal
        // 81% could be 8.1% if in table context, 87% could be 8.7%
        fixedText = fixedText.replace(/(\d)(\d)(%)/g, (match, first, second, percent) => {
            const fullNumber = parseInt(first + second);
            // For two-digit percentages, be more careful - only fix obvious cases
            if (fullNumber > 80 && fullNumber < 90) {
                return first + '.' + second + percent;
            }
            return match;
        });
        
        // Pattern 3: Fix standalone decimal points that got separated
        // Like "58 3%" -> "58.3%"
        fixedText = fixedText.replace(/(\d+)\s+(\d+)(%)/g, '$1.$2$3');
        
        // Pattern 4: Fix decimal points that became commas or other chars
        fixedText = fixedText.replace(/(\d+)[,،](\d+)(%)/g, '$1.$2$3');
        
        // Pattern 5: Handle cases where decimal point is recognized as 'o' or other chars
        fixedText = fixedText.replace(/(\d+)[o0](\d+)(%)/g, '$1.$2$3');
        
        return fixedText;
    }
    
    removeTableArtifacts(text) {
        // Remove table artifacts from processed text
        let cleanText = text;
        
        // Remove underscores (table borders)
        cleanText = cleanText.replace(/_/g, '');
        
        // Remove other table border characters
        cleanText = cleanText.replace(/[\|\-\+\=]/g, '');
        
        // Remove standalone dots or dashes that might be table elements
        cleanText = cleanText.replace(/^\.*$|^-*$/g, '');
        
        // Clean up extra spaces
        cleanText = cleanText.replace(/\s+/g, ' ').trim();
        
        return cleanText;
    }

    formatAsText(data) {
        // For non-table text, combine all text into a single line for Excel cell compatibility
        let allText = '';
        
        // Extract text from all paragraphs and lines
        if (data.paragraphs && data.paragraphs.length > 0) {
            data.paragraphs.forEach(paragraph => {
                const paragraphText = paragraph.text.trim();
                if (paragraphText) {
                    allText += paragraphText + ' ';
                }
            });
        } else if (data.lines && data.lines.length > 0) {
            // Fallback to lines if paragraphs are not available
            data.lines.forEach(line => {
                const lineText = line.text.trim();
                if (lineText) {
                    allText += lineText + ' ';
                }
            });
        } else {
            // Final fallback to raw text
            allText = data.text || '';
        }
        
        // Clean up the text for single cell compatibility:
        // 1. Remove multiple spaces
        // 2. Remove all line breaks and tabs
        // 3. Trim whitespace
        return allText
            .replace(/\s+/g, ' ')           // Replace multiple spaces with single space
            .replace(/[\r\n\t]/g, ' ')      // Replace line breaks and tabs with space
            .trim();                        // Remove leading/trailing whitespace
    }

    updateResultDisplay(uploadMode) {
        if (uploadMode === 'batch') {
            // For batch mode, separate each image's result with empty line
            this.resultText.value = this.recognizedTexts.join('\n\n');
        } else {
            // For single mode, show all results but process one at a time
            this.resultText.value = this.recognizedTexts.join('\n\n');
        }
    }

    updateProgress(percentage, message) {
        this.progressFill.style.width = `${percentage}%`;
        this.progressText.textContent = message;
    }

    showProgressBar() {
        this.progressBar.style.display = 'block';
        this.updateProgress(0, '準備開始...');
    }

    hideProgressBar() {
        setTimeout(() => {
            this.progressBar.style.display = 'none';
        }, 2000);
    }

    
    async copyToClipboard() {
        try {
            // Check if Clipboard API is supported (Safari has limited support)
            if (navigator.clipboard && navigator.clipboard.writeText) {
                await navigator.clipboard.writeText(this.resultText.value);
                this.showCopySuccess();
            } else {
                // Fallback for Safari and older browsers
                this.fallbackCopyToClipboard();
            }
        } catch (error) {
            // If Clipboard API fails, use fallback
            this.fallbackCopyToClipboard();
        }
    }
    
    fallbackCopyToClipboard() {
        // Create a temporary textarea for copying
        const textArea = document.createElement('textarea');
        textArea.value = this.resultText.value;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        
        try {
            document.execCommand('copy');
            this.showCopySuccess();
        } catch (err) {
            alert('複製失敗，請手動複製文字');
        } finally {
            document.body.removeChild(textArea);
        }
    }
    
    showCopySuccess() {
        const originalText = this.copyBtn.textContent;
        this.copyBtn.textContent = '已複製！';
        this.copyBtn.style.background = '#27ae60';
        
        setTimeout(() => {
            this.copyBtn.textContent = originalText;
            this.copyBtn.style.background = '';
        }, 2000);
    }

    handleUploadModeChange() {
        // Clear current results when switching modes
        this.resultText.value = '';
        this.copyBtn.disabled = true;
    }
    
    handleRecognitionModeChange() {
        // Clear current results when switching recognition modes
        this.resultText.value = '';
        this.copyBtn.disabled = true;
    }
    
    handlePaste(e) {
        e.preventDefault();
        
        const clipboardData = e.clipboardData || window.clipboardData;
        const items = clipboardData.items;
        
        let pastedFiles = [];
        
        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            
            if (item.type.indexOf('image') !== -1) {
                const file = item.getAsFile();
                if (file) {
                    // Create a proper name for pasted image
                    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
                    const extension = file.type.split('/')[1] || 'png';
                    const fileName = `pasted-image-${timestamp}.${extension}`;
                    
                    // Create a new File object with proper name
                    const namedFile = new File([file], fileName, {
                        type: file.type,
                        lastModified: Date.now()
                    });
                    
                    pastedFiles.push(namedFile);
                }
            }
        }
        
        if (pastedFiles.length > 0) {
            const uploadMode = document.querySelector('input[name="uploadMode"]:checked').value;
            const shouldAppend = uploadMode === 'batch' && this.files.length > 0;
            
            this.processFiles(pastedFiles, shouldAppend);
            
            // Show feedback to user
            const message = pastedFiles.length === 1 ? 
                '已貼上 1 張圖片' : 
                `已貼上 ${pastedFiles.length} 張圖片`;
            
            // Temporary feedback (could be improved with a proper toast notification)
            const originalText = document.querySelector('.upload-text div').textContent;
            document.querySelector('.upload-text div').textContent = message;
            
            setTimeout(() => {
                document.querySelector('.upload-text div').textContent = originalText;
            }, 2000);
        }
    }
}

// Initialize the OCR tool when page loads
document.addEventListener('DOMContentLoaded', () => {
    new OCRTool();
});