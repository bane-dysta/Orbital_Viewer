# config_write.py
import os
import json
import re
from datetime import datetime
from typing import List, Dict, Tuple
import logging

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(message)s')

class OrbitalRule:
    """轨道匹配规则基类"""
    def match(self, files: List[str]) -> List[List[str]]:
        """
        匹配文件并返回分组结果
        返回: 匹配到的文件组列表，每组是一个列表
        """
        raise NotImplementedError

class HoleElectronRule(OrbitalRule):
    """空穴-电子轨道匹配规则"""
    def match(self, files: List[str]) -> List[List[str]]:
        # 用于存储配对的轨道
        pairs = {}
        
        # 正则模式
        hole_pattern = re.compile(r'hole_(\d+)\.cub')
        electron_pattern = re.compile(r'electron_(\d+)\.cub')
        
        # 查找所有匹配的文件
        for file in files:
            # 检查是否是空穴文件
            hole_match = hole_pattern.search(file)
            if hole_match:
                index = hole_match.group(1)
                if index not in pairs:
                    pairs[index] = {'hole': None, 'electron': None}
                pairs[index]['hole'] = file
                continue
            
            # 检查是否是电子文件
            electron_match = electron_pattern.search(file)
            if electron_match:
                index = electron_match.group(1)
                if index not in pairs:
                    pairs[index] = {'hole': None, 'electron': None}
                pairs[index]['electron'] = file
        
        # 返回完整的配对
        result = []
        for pair in pairs.values():
            if pair['hole'] and pair['electron']:
                result.append([pair['hole'], pair['electron']])
        
        return result

def create_viewer_config(files: List[str], group_id: int = 0) -> Dict:
    """创建单个查看器组的配置"""
    if not files:
        return None
        
    return {
        "id": group_id,
        "title": f"轨道组 {group_id}",
        "color1": "#0000FF",  # 第一个文件用蓝色
        "color2": "#FF0000",  # 第二个文件用红色
        "isoValue": "0.002",
        "surfaceScale": "2.0",
        "showPositive": True,
        "fileName1": files[0],
        "fileName2": files[1] if len(files) > 1 else ""
    }

def generate_config(folder_path: str, rules: List[OrbitalRule]) -> Dict:
    """为指定文件夹生成配置"""
    config = {
        "version": "1.0",
        "timestamp": datetime.now().isoformat(),
        "viewers": []
    }
    
    group_id = 0
    
    # 遍历所有子文件夹
    for root, dirs, files in os.walk(folder_path):
        # 只处理 .cub 文件
        cub_files = [f for f in files if f.endswith('.cub')]
        if not cub_files:
            continue
            
        # 获取相对路径的文件列表
        rel_path_files = [os.path.relpath(os.path.join(root, f), folder_path) for f in cub_files]
        
        # 已处理的文件集合
        processed_files = set()
        
        # 应用每个规则
        for rule in rules:
            matched_groups = rule.match(rel_path_files)
            for files_group in matched_groups:
                # 创建查看器配置
                viewer_config = create_viewer_config(files_group, group_id)
                if viewer_config:
                    config['viewers'].append(viewer_config)
                    group_id += 1
                    # 添加到已处理文件集合
                    processed_files.update(files_group)
        
        # 处理未匹配的文件
        for file in rel_path_files:
            if file not in processed_files:
                viewer_config = create_viewer_config([file], group_id)
                if viewer_config:
                    config['viewers'].append(viewer_config)
                    group_id += 1
    
    return config

def write_config(folder_path: str, output_filename: str = None) -> str:
    """写入配置文件"""
    try:
        # 确保路径存在
        if not os.path.exists(folder_path):
            raise FileNotFoundError(f"文件夹不存在: {folder_path}")
        
        # 规则列表
        rules = [HoleElectronRule()]  # 可以在这里添加更多规则
        
        # 生成配置
        config = generate_config(folder_path, rules)
        
        # 如果没有指定输出文件名，使用默认名称
        if not output_filename:
            output_filename = f"orbital-viewer-config-{datetime.now().strftime('%Y-%m-%d')}.json"
        
        # 确保输出文件有 .json 扩展名
        if not output_filename.endswith('.json'):
            output_filename += '.json'
        
        # 构造输出路径
        output_path = os.path.join(folder_path, output_filename)
        
        # 写入配置文件
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(config, f, indent=2, ensure_ascii=False)
        
        logging.info(f"配置文件已生成: {output_path}")
        return output_path
        
    except Exception as e:
        logging.error(f"生成配置文件时出错: {str(e)}")
        raise

def main():
    """测试函数"""
    import sys
    if len(sys.argv) > 1:
        folder_path = sys.argv[1]
        try:
            config_path = write_config(folder_path)
            print(f"配置文件已生成: {config_path}")
        except Exception as e:
            print(f"错误: {str(e)}")
    else:
        print("请提供文件夹路径")

if __name__ == "__main__":
    main()