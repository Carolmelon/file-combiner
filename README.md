# File Combiner

This VSCode extension allows you to select multiple files and folders, and combine their contents into a new file.

## Features

- Select multiple files and folders in Explorer (hold Command/Ctrl key for multiple selection)
- Right-click and choose "Combine Selected File Contents"
- Automatically creates an unsaved file and opens it in the editor
- File contents are sorted by path depth
- Displays a directory tree structure of the common parent directory at the beginning
- Automatically detects and skips binary file contents (shows notification only)
- Automatically processes selected folder contents recursively
- Specify ignored files and directories through .file_combiner.ignore files
- Marks which files have their contents included in the output in the directory tree

## How to Use

1. Hold Command/Ctrl key and select multiple files and/or folders in VSCode Explorer
2. Right-click on the selected items and choose "Combine Selected File Contents"
3. A new unsaved editor tab will open, displaying the combined content
4. If you want to save the combined result, press Ctrl+S to choose a save location; if not, simply close the tab

## Output Format

The combined file follows this format:

```
================ Directory Structure ================
[Directory tree structure, with files marked [Output✓] if included in the combined content]

================ Common Parent Directory: [common parent path] ================

================file content start: [file path 1]================
[content of file 1]
================file content end: [file path 1]================

================file content start: [file path 2]================
[content of file 2]
================file content end: [file path 2]================

// For binary files
================file content start: [binary file path]================
[This is a binary file, content omitted]
================file content end: [binary file path]================
```

Files are sorted by path depth, with shallower paths appearing first.

## Ignore File Configuration

Create a `.file_combiner.ignore` file to specify files and directories to ignore in the directory tree.

### Ignore File Example

Create a `.file_combiner.ignore` file in any directory, with each line specifying a file or directory to ignore:

```
node_modules
dist
.git
build/temp
```

### Ignore Rules

- Each line in the ignore file represents a pattern to ignore
- Patterns can be directory names, file names, or relative paths
- Relative paths are relative to the directory containing the `.file_combiner.ignore` file
- Rules in an ignore file apply to its directory and all subdirectories
- Parent directory ignore rules apply to all subdirectories

#### Ignore Rules Example

If you have the following directory structure:
```
/project
  /.file_combiner.ignore  (contains "node_modules" and "src/temp")
  /node_modules/
  /src/
    /.file_combiner.ignore  (contains "logs")
    /temp/
    /logs/
    /components/
```

The directory tree generation will ignore:
- `/project/node_modules/` (based on root directory ignore rule)
- `/project/src/temp/` (based on root directory ignore rule)
- `/project/src/logs/` (based on src directory ignore rule)

## Folder Processing Behavior

When folders are selected, the extension will:

1. Recursively traverse all files in the selected folders
2. Apply all `.file_combiner.ignore` rules along the paths
3. Automatically remove duplicate paths (e.g., if both a folder and a file inside it are selected, only the folder is processed)
4. Mark files that actually have content output in the directory tree

## Notes

- The combined result is created as an unsaved document; confirm whether you need to save before closing
- The plugin automatically detects binary files (such as images, PDFs, etc.) and won't attempt to display their content
- The directory tree generation displays the entire common parent directory structure but marks which files have their content actually included

## Usage

1. Create the file structure described above
2. Run `npm install` in the project root directory to install dependencies
3. Press F5 to start the plugin in development mode
4. Hold Command/Ctrl key and select multiple files and/or folders in VSCode Explorer
5. Right-click on the selected items and choose "Combine Selected File Contents"
6. The plugin will create a new unsaved document, combining the contents of all selected files sorted by path depth, and open it in the editor
7. If you want to save, use Ctrl+S to choose a save location




# 文件合并器

这个VSCode扩展允许你选择多个文件和文件夹，并将它们的内容合并到一个新文件中。

## 功能

- 在资源管理器中选择多个文件和文件夹（按住Command/Ctrl键多选）
- 右键点击并选择"合并选中的文件内容"
- 自动创建一个未保存的文件并在编辑器中打开
- 文件内容按照路径深度排序
- 在合并内容开头显示所有文件的共同父目录的目录树结构
- 自动检测并跳过二进制文件内容（只显示提示信息）
- 自动递归处理选中的文件夹内容
- 通过.file_combiner.ignore文件指定忽略的文件和目录
- 目录树中标记出哪些文件的内容已被输出

## 使用方法

1. 在VSCode资源管理器中按住Command/Ctrl键选择多个文件和/或文件夹
2. 右键点击选中的项目，选择"合并选中的文件内容"
3. 一个新的未保存编辑器标签页将会打开，显示合并后的内容
4. 如需保存合并结果，按Ctrl+S选择保存位置；如不需保存，直接关闭标签页即可

## 输出格式

合并后的文件格式如下：

```
================ 目录结构 ================
[目录树结构，已输出的文件会标记为 [已输出详细内容✅]]

================ 共同父目录: [共同父目录路径] ================

================file content start: [文件路径1]================
[文件1的内容]
================file content end: [文件路径1]================

================file content start: [文件路径2]================
[文件2的内容]
================file content end: [文件路径2]================

// 对于二进制文件
================file content start: [二进制文件路径]================
[该文件为二进制文件，省略内容]
================file content end: [二进制文件路径]================
```

文件按照路径深度排序，路径越浅的文件排在越前面。

## 忽略文件配置

通过创建`.file_combiner.ignore`文件，可以指定在目录树中忽略的文件或目录。

### 忽略文件示例

在任意目录中创建`.file_combiner.ignore`文件，每行指定一个要忽略的文件或目录：

```
node_modules
dist
.git
build/temp
```

### 忽略规则

- 忽略文件中的每一行代表一个要忽略的模式
- 模式可以是目录名、文件名或相对路径
- 相对路径是相对于`.file_combiner.ignore`文件所在的目录
- 忽略文件的规则会应用于所在目录及其所有子目录
- 父目录的忽略规则会应用于所有子目录

#### 忽略规则示例

如果存在以下目录结构：
```
/project
  /.file_combiner.ignore  (包含 "node_modules" 和 "src/temp")
  /node_modules/
  /src/
    /.file_combiner.ignore  (包含 "logs")
    /temp/
    /logs/
    /components/
```

则目录树生成时会忽略：
- `/project/node_modules/`（基于根目录的忽略规则）
- `/project/src/temp/`（基于根目录的忽略规则）
- `/project/src/logs/`（基于src目录的忽略规则）

## 文件夹处理行为

当选择文件夹时，扩展会：

1. 递归遍历所选文件夹中的所有文件
2. 应用所有路径上的`.file_combiner.ignore`规则
3. 自动删除重复路径（例如，如果同时选择了文件夹及其内部的文件，则只处理文件夹）
4. 在目录树中标记实际输出了内容的文件

## 注意事项

- 合并结果默认创建为未保存的文档，关闭前请确认是否需要保存
- 插件会自动检测二进制文件（如图片、PDF等），不会尝试显示其内容
- 目录树生成会显示整个共同父目录的结构，但会标记出哪些文件的内容被实际输出

## 使用方法

1. 创建上述文件结构
2. 在项目根目录运行 `npm install` 安装依赖
3. 按 F5 在开发模式下启动插件
4. 在资源管理器中按住Command/Ctrl键选择多个文件和/或文件夹
5. 右键点击选中的项目，选择"合并选中的文件内容"
6. 插件会创建一个新的未保存文档，将所有选中文件的内容按路径深度排序后合并，并在编辑器中打开
7. 如需保存，使用Ctrl+S选择保存位置

