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
        
        // 找到所有文件的共同父目录
        const commonParentDir = findCommonParentDirectory(filePaths);
        
        // 生成目录树
        let treeOutput = '';
        try {
            treeOutput = generateDirectoryTree(commonParentDir);
        } catch (error) {
            console.error('生成目录树失败:', error);
            treeOutput = `无法生成目录树: ${error}\n\n`;
        }

        // 合并文件内容
        try {
            // 创建未保存的文件而不是临时文件
            const untitledDoc = await vscode.workspace.openTextDocument({ 
                content: '',
                language: 'plaintext' 
            });
            
            const editor = await vscode.window.showTextDocument(untitledDoc);
            
            // 按照路径深度排序
            const sortedPaths = sortFilesByDepth(filePaths);
            
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
            
            vscode.window.showInformationMessage(`已合并 ${filePaths.length} 个文件`);
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
function generateDirectoryTree(dirPath: string): string {
    try {
        // 尝试使用系统命令生成目录树
        if (process.platform === 'win32') {
            // Windows使用tree命令并确保使用UTF-8编码
            return child_process.execSync(`tree /f "${dirPath}"`, { encoding: 'utf8' });
        } else {
            // Linux/Mac尝试使用tree命令
            try {
                // 确保使用UTF-8编码
                return child_process.execSync(`tree "${dirPath}"`, { 
                    encoding: 'utf8',
                    env: { ...process.env, LANG: 'en_US.UTF-8' }
                });
            } catch (error) {
                // 如果tree命令不可用，使用find加ls命令模拟
                return child_process.execSync(`find "${dirPath}" -type f | sort`, { 
                    encoding: 'utf8',
                    env: { ...process.env, LANG: 'en_US.UTF-8' }
                });
            }
        }
    } catch (error) {
        // 如果外部命令失败，使用自定义函数生成目录树
        return customDirectoryTree(dirPath);
    }
}

// 自定义函数生成目录树
function customDirectoryTree(dirPath: string, prefix: string = ''): string {
    let output = `${prefix}${path.basename(dirPath)}/\n`;
    
    try {
        const entries = fs.readdirSync(dirPath, { withFileTypes: true });
        const dirs = entries.filter(entry => entry.isDirectory());
        const files = entries.filter(entry => entry.isFile());
        
        // 处理子目录
        dirs.forEach((dir, index) => {
            const isLast = index === dirs.length - 1 && files.length === 0;
            const newPrefix = prefix + (isLast ? '    ' : '│   ');
            output += prefix + (isLast ? '└── ' : '├── ');
            output += customDirectoryTree(path.join(dirPath, dir.name), newPrefix);
        });
        
        // 处理文件
        files.forEach((file, index) => {
            const isLast = index === files.length - 1;
            output += prefix + (isLast ? '└── ' : '├── ') + file.name + '\n';
        });
        
        return output;
    } catch (error) {
        return output + `${prefix}错误：无法读取目录 - ${error}\n`;
    }
}

export function deactivate() {}