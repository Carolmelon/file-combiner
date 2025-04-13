import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as child_process from 'child_process';

export function activate(context: vscode.ExtensionContext) {
    // 注册命令
    let disposable = vscode.commands.registerCommand('filesCombiner.combineFiles', async (uri, selectedFiles) => {
        // selectedFiles 是一个 URI[] 数组，包含所有选中的文件
        if (!selectedFiles || !Array.isArray(selectedFiles) || selectedFiles.length === 0) {
            // 如果没有通过参数传入选中的文件，则尝试获取当前选中的文件
            if (uri) {
                selectedFiles = [uri];
            } else {
                vscode.window.showInformationMessage('请先在资源管理器中选择文件');
                return;
            }
        }
        
        // 将 URI 转换为文件路径
        const filePaths = selectedFiles.map((fileUri: vscode.Uri) => fileUri.fsPath);
        
        // 处理重复的路径（例如，如果一个文件夹和其中的文件都被选中）
        const processedPaths = removeDuplicatePaths(filePaths);
        
        // 找到所有文件的共同父目录
        const commonParentDir = findCommonParentDirectory(processedPaths);
        
        // 合并文件内容
        try {
            // 创建未保存的文件而不是临时文件
            const untitledDoc = await vscode.workspace.openTextDocument({ 
                content: '',
                language: 'plaintext' 
            });
            
            const editor = await vscode.window.showTextDocument(untitledDoc);
            
            // 展开文件夹并收集所有文件
            const allFiles = await collectAllFiles(processedPaths);
            
            // 按照路径深度排序
            const sortedPaths = sortFilesByDepth(allFiles);
            
            // 生成目录树（传递处理文件列表进去）
            let treeOutput = '';
            try {
                treeOutput = generateDirectoryTree(commonParentDir, sortedPaths);
            } catch (error) {
                console.error('生成目录树失败:', error);
                treeOutput = `无法生成目录树: ${error}\n\n`;
            }
            
            // 组合所有内容
            let outputContent = `================ 目录结构 ================\n${treeOutput}\n`;
            outputContent += `================ 共同父目录: [${commonParentDir}] ================\n\n`;
            
            for (const filePath of sortedPaths) {
                try {
                    // 检查是否为二进制文件
                    if (isBinaryFile(filePath)) {
                        outputContent += `================file content start: [${filePath}]================\n`;
                        outputContent += `[该文件为二进制文件，省略内容]\n`;
                        outputContent += `================file content end: [${filePath}]================\n\n`;
                    } else {
                        // 读取文件内容
                        const content = fs.readFileSync(filePath, 'utf-8');
                        
                        // 添加格式化的内容
                        outputContent += `================file content start: [${filePath}]================\n`;
                        outputContent += content;
                        
                        // 确保内容末尾有换行符
                        if (!content.endsWith('\n')) {
                            outputContent += '\n';
                        }
                        
                        outputContent += `================file content end: [${filePath}]================\n\n`;
                    }
                } catch (error) {
                    outputContent += `================file content start: [${filePath}]================\n`;
                    outputContent += `错误：无法读取文件 - ${error}\n`;
                    outputContent += `================file content end: [${filePath}]================\n\n`;
                }
            }
            
            // 将内容写入未保存的文档
            await editor.edit(editBuilder => {
                const entireRange = new vscode.Range(
                    new vscode.Position(0, 0),
                    new vscode.Position(untitledDoc.lineCount, 0)
                );
                editBuilder.replace(entireRange, outputContent);
            });
            
            vscode.window.showInformationMessage(`已合并 ${allFiles.length} 个文件`);
        } catch (error) {
            vscode.window.showErrorMessage(`合并文件失败: ${error}`);
        }
    });

    context.subscriptions.push(disposable);
}

// 检查文件是否为二进制文件
function isBinaryFile(filePath: string): boolean {
    try {
        // 读取文件的前4KB内容进行检查
        const buffer = Buffer.alloc(4096);
        const fd = fs.openSync(filePath, 'r');
        const bytesRead = fs.readSync(fd, buffer, 0, 4096, 0);
        fs.closeSync(fd);
        
        // 检查是否含有空字节（NULL）或不可打印的控制字符，这通常表示是二进制文件
        for (let i = 0; i < bytesRead; i++) {
            const byte = buffer[i];
            // 0是NULL字节，常见于二进制文件
            // 小于32且不是空格、制表符、换行符等的是控制字符
            if (byte === 0 || (byte < 32 && ![9, 10, 13].includes(byte))) {
                return true;
            }
        }
        
        // 检查文件扩展名
        const ext = path.extname(filePath).toLowerCase();
        const binaryExtensions = [
            '.png', '.jpg', '.jpeg', '.gif', '.bmp', '.ico', '.webp', 
            '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
            '.zip', '.rar', '.7z', '.tar', '.gz', '.bz2',
            '.exe', '.dll', '.so', '.dylib',
            '.mp3', '.mp4', '.avi', '.mov', '.mkv', '.flv'
        ];
        
        if (binaryExtensions.includes(ext)) {
            return true;
        }
        
        return false;
    } catch (error) {
        // 如果无法读取文件，假设它是二进制文件
        return true;
    }
}

// 按照路径深度排序文件
function sortFilesByDepth(filePaths: string[]): string[] {
    return [...filePaths].sort((a, b) => {
        // 统一使用正斜杠计算深度
        const depthA = a.replace(/\\/g, '/').split('/').length;
        const depthB = b.replace(/\\/g, '/').split('/').length;
        return depthA - depthB;
    });
}

// 找到所有文件的共同父目录
function findCommonParentDirectory(filePaths: string[]): string {
    if (filePaths.length === 0) {
        return '';
    }
    
    if (filePaths.length === 1) {
        return path.dirname(filePaths[0]);
    }
    
    // 获取每个文件的目录部分，分割成路径组件
    const pathComponents = filePaths.map(filePath => {
        const dirPath = path.dirname(filePath);
        return dirPath.replace(/\\/g, '/').split('/');
    });
    
    // 找到最短的路径长度
    const minLength = Math.min(...pathComponents.map(components => components.length));
    
    // 查找共同部分
    let commonComponents = [];
    for (let i = 0; i < minLength; i++) {
        const component = pathComponents[0][i];
        if (pathComponents.every(components => components[i] === component)) {
            commonComponents.push(component);
        } else {
            break;
        }
    }
    
    // 如果没有共同部分，返回根目录
    if (commonComponents.length === 0) {
        return '/';
    }
    
    // 重建共同父目录路径
    return commonComponents.join(path.sep);
}

// 生成目录树
function generateDirectoryTree(dirPath: string, includedFiles: string[] = []): string {
    try {
        // 首先收集忽略规则
        const ignorePatterns = collectIgnorePatterns(dirPath);
        
        // 尝试使用系统命令生成目录树
        if (process.platform === 'win32') {
            // Windows使用自定义函数，因为Windows的tree命令不支持忽略功能
            return customDirectoryTree(dirPath, '', ignorePatterns, includedFiles);
        } else {
            // Linux/Mac - 尝试使用自定义函数，以保持一致性
            return customDirectoryTree(dirPath, '', ignorePatterns, includedFiles);
        }
    } catch (error) {
        // 如果外部命令失败，使用自定义函数生成目录树
        const ignorePatterns = collectIgnorePatterns(dirPath);
        return customDirectoryTree(dirPath, '', ignorePatterns, includedFiles);
    }
}

// 收集忽略规则
function collectIgnorePatterns(basePath: string): Map<string, Set<string>> {
    const ignoreMap = new Map<string, Set<string>>();
    
    // 递归查找所有父目录
    function findIgnoreFiles(currentPath: string) {
        // 检查当前目录是否有忽略文件
        const ignoreFilePath = path.join(currentPath, '.file_combiner.ignore');
        if (fs.existsSync(ignoreFilePath)) {
            try {
                const ignoreContent = fs.readFileSync(ignoreFilePath, 'utf-8');
                const patterns = ignoreContent.split('\n')
                    .map(line => line.trim())
                    .filter(line => line && !line.startsWith('#'));
                
                ignoreMap.set(currentPath, new Set(patterns));
            } catch (err) {
                console.error(`读取忽略文件出错: ${ignoreFilePath}`, err);
            }
        }
        
        // 检查父目录，直到到达文件系统根目录
        const parentPath = path.dirname(currentPath);
        if (parentPath !== currentPath) {
            findIgnoreFiles(parentPath);
        }
    }
    
    findIgnoreFiles(basePath);
    return ignoreMap;
}

// 检查路径是否应该被忽略
function shouldIgnorePath(fullPath: string, basePath: string, ignorePatterns: Map<string, Set<string>>): boolean {
    // 对于每个包含忽略规则的目录
    for (const [dirPath, patterns] of ignorePatterns.entries()) {
        // 计算相对路径（相对于忽略文件所在目录）
        const relPath = path.relative(dirPath, fullPath);
        
        for (const pattern of patterns) {
            // 检查是否完全匹配
            if (relPath === pattern) {
                return true;
            }
            
            // 检查是否是目录前缀匹配
            if (relPath.startsWith(pattern + path.sep)) {
                return true;
            }
        }
    }
    
    return false;
}

// 自定义函数生成目录树
function customDirectoryTree(
    dirPath: string, 
    prefix: string = '', 
    ignorePatterns: Map<string, Set<string>> = new Map(),
    includedFiles: string[] = []
): string {
    const dirName = path.basename(dirPath);
    let output = `${prefix}${dirName}/\n`;
    
    try {
        const entries = fs.readdirSync(dirPath, { withFileTypes: true });
        const dirs = entries.filter(entry => entry.isDirectory());
        const files = entries.filter(entry => entry.isFile());
        
        // 过滤掉应该被忽略的目录
        const filteredDirs = dirs.filter(dir => {
            const fullPath = path.join(dirPath, dir.name);
            return !shouldIgnorePath(fullPath, dirPath, ignorePatterns);
        });
        
        // 过滤掉应该被忽略的文件
        const filteredFiles = files.filter(file => {
            const fullPath = path.join(dirPath, file.name);
            return !shouldIgnorePath(fullPath, dirPath, ignorePatterns);
        });
        
        // 处理子目录
        filteredDirs.forEach((dir, index) => {
            const isLast = index === filteredDirs.length - 1 && filteredFiles.length === 0;
            const newPrefix = prefix + (isLast ? '    ' : '│   ');
            const linePrefix = prefix + (isLast ? '└── ' : '├── ');
            output += linePrefix + customDirectoryTree(
                path.join(dirPath, dir.name), 
                newPrefix, 
                ignorePatterns,
                includedFiles
            ).substring(prefix.length);
        });
        
        // 处理文件
        filteredFiles.forEach((file, index) => {
            const isLast = index === filteredFiles.length - 1;
            const fullPath = path.join(dirPath, file.name);
            
            // 检查文件是否包含在处理列表中
            const isIncluded = includedFiles.includes(fullPath);
            
            // 添加标记符号，如果文件被包含在输出中
            const marker = isIncluded ? ' [已输出详细内容✅]' : '';
            
            output += prefix + (isLast ? '└── ' : '├── ') + file.name + marker + '\n';
        });
        
        return output;
    } catch (error) {
        return output + `${prefix}错误：无法读取目录 - ${error}\n`;
    }
}

// 检查一个路径是否包含在另一个路径中
function isPathContained(parentPath: string, childPath: string): boolean {
    const relativePath = path.relative(parentPath, childPath);
    return !relativePath.startsWith('..') && relativePath !== '';
}

// 移除重复路径（如果一个路径已经包含在另一个路径中）
function removeDuplicatePaths(paths: string[]): string[] {
    const result: string[] = [];
    
    // 检查是否为目录
    const isDirectory = (p: string) => {
        try {
            return fs.statSync(p).isDirectory();
        } catch (error) {
            return false;
        }
    };
    
    // 首先按字符串长度排序（最短的可能是父目录）
    const sortedPaths = [...paths].sort((a, b) => a.length - b.length);
    
    // 检查每个路径
    for (const currentPath of sortedPaths) {
        // 如果是文件，不是目录，则必须保留
        if (!isDirectory(currentPath)) {
            // 检查这个文件是否已经包含在之前添加的目录中
            let isContained = false;
            for (const existingPath of result) {
                if (isDirectory(existingPath) && isPathContained(existingPath, currentPath)) {
                    isContained = true;
                    break;
                }
            }
            
            if (!isContained) {
                result.push(currentPath);
            }
            continue;
        }
        
        // 对于目录，检查它是否已经被包含
        let shouldAdd = true;
        
        // 检查该目录是否是已添加目录的子目录
        for (const existingPath of result) {
            if (isDirectory(existingPath) && isPathContained(existingPath, currentPath)) {
                shouldAdd = false;
                break;
            }
        }
        
        // 如果这个目录应该被添加，则需要删除它包含的任何现有路径
        if (shouldAdd) {
            // 标记要删除的路径
            const toRemove = [];
            for (let i = 0; i < result.length; i++) {
                if (isPathContained(currentPath, result[i])) {
                    toRemove.push(i);
                }
            }
            
            // 从后往前删除，避免索引变化问题
            for (let i = toRemove.length - 1; i >= 0; i--) {
                result.splice(toRemove[i], 1);
            }
            
            result.push(currentPath);
        }
    }
    
    return result;
}

// 收集所有文件（递归目录）
async function collectAllFiles(paths: string[]): Promise<string[]> {
    const allFiles: string[] = [];
    const ignorePatterns = new Map<string, Set<string>>();
    
    // 收集所有路径上的忽略规则
    for (const p of paths) {
        if (fs.statSync(p).isDirectory()) {
            const patterns = collectIgnorePatterns(p);
            for (const [dir, pattern] of patterns.entries()) {
                if (!ignorePatterns.has(dir)) {
                    ignorePatterns.set(dir, new Set());
                }
                pattern.forEach(p => ignorePatterns.get(dir)!.add(p));
            }
        }
    }
    
    // 递归处理每个路径
    for (const p of paths) {
        if (fs.statSync(p).isDirectory()) {
            // 如果是目录，递归收集文件
            await collectFilesFromDirectory(p, allFiles, ignorePatterns);
        } else {
            // 如果是文件，直接添加
            allFiles.push(p);
        }
    }
    
    return allFiles;
}

// 从目录中递归收集文件
async function collectFilesFromDirectory(dirPath: string, fileList: string[], ignorePatterns: Map<string, Set<string>>): Promise<void> {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    
    for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        
        // 检查是否应该忽略
        if (shouldIgnorePath(fullPath, dirPath, ignorePatterns)) {
            continue;
        }
        
        if (entry.isDirectory()) {
            // 递归处理子目录
            await collectFilesFromDirectory(fullPath, fileList, ignorePatterns);
        } else {
            // 添加文件
            fileList.push(fullPath);
        }
    }
}

export function deactivate() {}