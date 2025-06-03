#!/usr/bin/env python3
"""
سكريبت التنظيف النهائي لإزالة جميع الأنماط القديمة المتبقية
"""

import os
import re
from pathlib import Path

# الإصلاحات النهائية المطلوبة
FINAL_FIXES = [
    # إصلاح الأخطاء في types/roles.ts
    ('system_admin:', 'system_admin:'),
    ('org_owner:', 'org_owner:'),
    ('org_admin:', 'org_admin:'),
    
    # إصلاح الأخطاء في DocumentationPage
    ('=== 'org_owner'', "=== 'org_owner'"),
    ('independent', 'independent'),
    
    # إصلاح Django admin panel
    ('is_system_owner', 'is_system_owner'),
    ('is_system_admin', 'is_system_admin'),
    ('is_org_owner', 'is_org_owner'),
    ('is_org_admin', 'is_org_admin'),
    ("'system_owner'", "'system_owner'"),
    ("'system_admin'", "'system_admin'"),
    ("'org_owner'", "'org_owner'"),
    ("'org_admin'", "'org_admin'"),
    ("'independent'", "'independent'"),
    
    # إصلاح Firebase Rules
    ('getUserToken().isOrgOwner', 'getUserToken().isOrgOwner'),
    ('getUserToken().isOrgAdmin', 'getUserToken().isOrgAdmin'),
    ("role == 'org_admin'", "role == 'org_admin'"),
    
    # إصلاح الأخطاء المتبقية
    ('isIndependent', 'independent'),
    ('system_owner', 'system_owner'),
    ('org_owner', 'org_owner'),
    ('org_admin', 'org_admin'),
    
    # إزالة التكرارات
    ('isSystemOwner: customClaims.isSystemOwner,\n            isSystemAdmin: customClaims.isSystemAdmin,', 
     'isSystemOwner: customClaims.isSystemOwner,\n            isSystemAdmin: customClaims.isSystemAdmin,'),
]

# أنواع الملفات المدعومة
SUPPORTED_EXTENSIONS = {'.ts', '.tsx', '.js', '.jsx', '.py', '.rules'}

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

def process_file(file_path: Path) -> tuple[int, bool]:
    """معالجة ملف واحد وإرجاع عدد التغييرات وما إذا كان تم تعديل الملف"""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        original_content = content
        changes_count = 0
        
        # تطبيق جميع الإصلاحات
        for old_pattern, new_pattern in FINAL_FIXES:
            if old_pattern in content:
                content = content.replace(old_pattern, new_pattern)
                changes_count += original_content.count(old_pattern)
        
        # إزالة الأسطر الفارغة الزائدة
        content = re.sub(r'\n\s*\n\s*\n', '\n\n', content)
        
        # كتابة الملف إذا تم تعديله
        if content != original_content:
            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(content)
            return changes_count, True
        
        return 0, False
        
    except Exception as e:
        print(f"❌ خطأ في معالجة الملف {file_path}: {e}")
        return 0, False

def main():
    """الدالة الرئيسية"""
    print("🔧 بدء التنظيف النهائي...")
    print("=" * 50)
    
    project_root = Path(__file__).parent
    print(f"📁 مسار المشروع: {project_root}")
    
    total_files_processed = 0
    total_files_modified = 0
    total_changes = 0
    
    # البحث في جميع الملفات
    for file_path in project_root.rglob('*'):
        if file_path.is_file() and should_process_file(file_path):
            changes_count, was_modified = process_file(file_path)
            
            if was_modified:
                total_files_modified += 1
                total_changes += changes_count
                relative_path = file_path.relative_to(project_root)
                print(f"✅ تم إصلاح: {relative_path} ({changes_count} تغيير)")
            
            total_files_processed += 1
    
    print("=" * 50)
    print("📊 ملخص التنظيف النهائي:")
    print(f"   📁 إجمالي الملفات المعالجة: {total_files_processed}")
    print(f"   🔧 الملفات المُصلحة: {total_files_modified}")
    print(f"   🔄 إجمالي الإصلاحات: {total_changes}")
    
    if total_files_modified > 0:
        print("\n🎉 تم الانتهاء من التنظيف النهائي!")
        print("✨ النظام الآن يستخدم النمط الجديد is* بشكل صحيح ومتسق.")
        print("🚀 يمكنك الآن بناء ونشر التطبيق.")
    else:
        print("\n✨ النظام نظيف ومتسق بالفعل!")

if __name__ == "__main__":
    main()
