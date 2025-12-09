class OCRTool {
    constructor() {
        this.files = [];
        this.currentFileIndex = 0;
        this.recognizedTexts = [];
        this.isProcessing = false;
        
        this.initializeElements();
        this.bindEvents();
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
            // Detect language automatically
            const languages = await this.detectLanguage(file);
            
            // Perform OCR with detected languages
            const result = await Tesseract.recognize(file, languages, {
                logger: m => {
                    if (m.status === 'recognizing text') {
                        const progress = Math.floor(m.progress * 100);
                        this.updateProgress(
                            (this.currentFileIndex / this.files.length) * 100 + (progress / this.files.length),
                            `辨識中... ${progress}%`
                        );
                    }
                }
            });

            // Process the recognized text to preserve layout
            return this.processRecognizedText(result.data);

        } catch (error) {
            console.error('Error processing image:', error);
            return `辨識失敗: ${file.name}`;
        }
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
        // Balanced table detection logic
        const lines = this.groupWordsByLines(words);
        if (lines.length < 2) return false; // Need at least 2 rows
        
        // Check if there are consistent column alignments
        const columnCounts = lines.map(line => line.length);
        const avgColumns = columnCounts.reduce((a, b) => a + b, 0) / columnCounts.length;
        
        // Criteria for table detection:
        // 1. Must have at least 2 columns on average
        // 2. At least 60% of lines must have similar column count  
        // 3. Must have reasonable column separation
        if (avgColumns < 2) return false;
        
        const similarColumnCountLines = columnCounts.filter(count => 
            Math.abs(count - avgColumns) <= 1
        );
        
        if (similarColumnCountLines.length / lines.length < 0.6) return false;
        
        // Check for column separation and reject continuous text
        const hasProperStructure = this.hasTableStructure(lines);
        
        return hasProperStructure;
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
        const lines = [];
        let currentLine = [];
        let lastY = null;
        
        words.forEach(word => {
            if (lastY !== null && Math.abs(word.bbox.y0 - lastY) > 20) {
                if (currentLine.length > 0) {
                    lines.push([...currentLine]);
                    currentLine = [];
                }
            }
            currentLine.push(word);
            lastY = word.bbox.y0;
        });
        
        if (currentLine.length > 0) {
            lines.push(currentLine);
        }
        
        return lines;
    }

    formatAsTable(words) {
        const lines = this.groupWordsByLines(words);
        let tableText = '';
        
        lines.forEach(line => {
            const sortedWords = line.sort((a, b) => a.bbox.x0 - b.bbox.x0);
            const lineText = sortedWords.map(word => word.text).join('\t');
            tableText += lineText + '\n';
        });
        
        return tableText;
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