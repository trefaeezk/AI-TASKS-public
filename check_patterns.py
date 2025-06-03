#!/usr/bin/env python3
"""
سكريبت للتحقق من الأنماط القديمة الموجودة في المشروع قبل الاستبدال
"""

import os
import re
from pathlib import Path
from collections import defaultdict

# الأنماط القديمة للبحث عنها
OLD_PATTERNS = [
    'system_owner:',
    'system_admin:',
    'org_owner:',
    'org_admin:',
    'org_supervisor:',
    'org_engineer:',
    'org_technician:',
    'org_assistant:',
    'independent:',
    '.isSystemOwner',
    '.isSystemAdmin',
    '.isOrgOwner',
    '.isOrgAdmin',
    '.isOrgSupervisor',
    '.isOrgEngineer',
    '.isOrgTechnician',
    '.isOrgAssistant',
    '.isIndependent',
    'userClaims?.isSystemOwner',
    'userClaims?.isSystemAdmin',
    'userClaims?.isOrgOwner',
    'userClaims?.isOrgAdmin',
    'userData.isSystemOwner',
    'userData.isSystemAdmin',
    'userData.isOrgOwner',
    'userData.isOrgAdmin',
]

# أنواع الملفات المدعومة
SUPPORTED_EXTENSIONS = {'.ts', '.tsx', '.js', '.jsx', '.py'}

# المجلدات المستثناة
EXCLUDED_DIRS = {
    'node_modules', 
    '.git', 
    'dist', 
    'build', 
    '__pycache__',
    '.next',
    'coverage',
    '.vscode',
    '.idea'
}

def should_process_file(file_path: Path) -> bool:
    """تحديد ما إذا كان يجب معالجة الملف"""
    if file_path.suffix not in SUPPORTED_EXTENSIONS:
        return False
    
    for part in file_path.parts:
        if part in EXCLUDED_DIRS:
            return False
    
    return True

def find_patterns_in_file(file_path: Path) -> dict:
    """البحث عن الأنماط القديمة في ملف واحد"""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        found_patterns = defaultdict(list)
        lines = content.split('\n')
        
        for line_num, line in enumerate(lines, 1):
            for pattern in OLD_PATTERNS:
                if pattern in line:
                    found_patterns[pattern].append({
                        'line_number': line_num,
                        'line_content': line.strip()
                    })
        
        return dict(found_patterns)
        
    except Exception as e:
        print(f"❌ خطأ في قراءة الملف {file_path}: {e}")
        return {}

def main():
    """الدالة الرئيسية"""
    print("🔍 البحث عن الأنماط القديمة في المشروع...")
    print("=" * 60)
    
    project_root = Path(__file__).parent
    print(f"📁 مسار المشروع: {project_root}")
    
    total_files_checked = 0
    files_with_patterns = 0
    total_pattern_occurrences = 0
    all_findings = {}
    
    # البحث في جميع الملفات
    for file_path in project_root.rglob('*'):
        if file_path.is_file() and should_process_file(file_path):
            patterns_found = find_patterns_in_file(file_path)
            
            if patterns_found:
                files_with_patterns += 1
                relative_path = file_path.relative_to(project_root)
                all_findings[str(relative_path)] = patterns_found
                
                pattern_count = sum(len(occurrences) for occurrences in patterns_found.values())
                total_pattern_occurrences += pattern_count
                
                print(f"\n📄 {relative_path} ({pattern_count} نمط قديم):")
                for pattern, occurrences in patterns_found.items():
                    print(f"   🔸 {pattern} ({len(occurrences)} مرة):")
                    for occurrence in occurrences[:3]:  # عرض أول 3 مرات فقط
                        print(f"      السطر {occurrence['line_number']}: {occurrence['line_content']}")
                    if len(occurrences) > 3:
                        print(f"      ... و {len(occurrences) - 3} مرات أخرى")
            
            total_files_checked += 1
    
    print("\n" + "=" * 60)
    print("📊 ملخص النتائج:")
    print(f"   📁 إجمالي الملفات المفحوصة: {total_files_checked}")
    print(f"   📄 الملفات التي تحتوي على أنماط قديمة: {files_with_patterns}")
    print(f"   🔸 إجمالي الأنماط القديمة الموجودة: {total_pattern_occurrences}")
    
    if files_with_patterns > 0:
        print(f"\n💡 تم العثور على {total_pattern_occurrences} نمط قديم في {files_with_patterns} ملف.")
        print("🔄 يمكنك الآن تشغيل سكريبت replace_old_patterns.py لاستبدالها.")
        
        # إنشاء تقرير مفصل
        report_path = project_root / "old_patterns_report.txt"
        with open(report_path, 'w', encoding='utf-8') as f:
            f.write("تقرير الأنماط القديمة الموجودة في المشروع\n")
            f.write("=" * 50 + "\n\n")
            
            for file_path, patterns in all_findings.items():
                f.write(f"الملف: {file_path}\n")
                f.write("-" * 30 + "\n")
                for pattern, occurrences in patterns.items():
                    f.write(f"النمط: {pattern} ({len(occurrences)} مرة)\n")
                    for occurrence in occurrences:
                        f.write(f"  السطر {occurrence['line_number']}: {occurrence['line_content']}\n")
                f.write("\n")
        
        print(f"📝 تم حفظ تقرير مفصل في: {report_path}")
    else:
        print("\n✨ لم يتم العثور على أي أنماط قديمة! المشروع يستخدم النمط الجديد بالفعل.")

if __name__ == "__main__":
    main()
