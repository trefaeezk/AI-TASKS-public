#!/usr/bin/env python3
"""
سكريبت شامل لإزالة جميع الأنماط القديمة والأدوار القديمة من المشروع
"""

import os
import re
from pathlib import Path
from collections import defaultdict

# قائمة شاملة للأنماط القديمة والجديدة
COMPREHENSIVE_REPLACEMENTS = [
    # === الأدوار القديمة المهجورة ===
    # إزالة الأدوار القديمة تماماً
    ('|| userClaims?.role === \'admin\'', ''),
    ('|| userClaims?.role === \'owner\'', ''),
    ('', ''),
    ('', ''),
    ('|| userClaims?.role === \'org_owner\'', ''),
    ('userClaims?.isOrgAdmin', 'userClaims?.isOrgAdmin'),
    ('userClaims?.isOrgOwner', 'userClaims?.isOrgOwner'),
    
    # === النمط القديم إلى الجديد ===
    # الأدوار الأساسية - القيم الثابتة
    ('isSystemOwner: true', 'isSystemOwner: true'),
    ('isSystemOwner: false', 'isSystemOwner: false'),
    ('isSystemAdmin: true', 'isSystemAdmin: true'),
    ('isSystemAdmin: false', 'isSystemAdmin: false'),
    ('isOrgOwner: true', 'isOrgOwner: true'),
    ('isOrgOwner: false', 'isOrgOwner: false'),
    ('isOrgAdmin: true', 'isOrgAdmin: true'),
    ('isOrgAdmin: false', 'isOrgAdmin: false'),
    ('isOrgSupervisor: true', 'isOrgSupervisor: true'),
    ('isOrgSupervisor: false', 'isOrgSupervisor: false'),
    ('isOrgEngineer: true', 'isOrgEngineer: true'),
    ('isOrgEngineer: false', 'isOrgEngineer: false'),
    ('isOrgTechnician: true', 'isOrgTechnician: true'),
    ('isOrgTechnician: false', 'isOrgTechnician: false'),
    ('isOrgAssistant: true', 'isOrgAssistant: true'),
    ('isOrgAssistant: false', 'isOrgAssistant: false'),
    ('isIndependent: true', 'isIndependent: true'),
    ('isIndependent: false', 'isIndependent: false'),
    
    # الأدوار الديناميكية
    ("isSystemOwner: role === 'system_owner'", "isSystemOwner: role === 'system_owner'"),
    ("isSystemAdmin: role === 'system_admin'", "isSystemAdmin: role === 'system_admin'"),
    ("isOrgOwner: role === 'org_owner'", "isOrgOwner: role === 'org_owner'"),
    ("isOrgAdmin: role === 'org_admin'", "isOrgAdmin: role === 'org_admin'"),
    ("isOrgSupervisor: role === 'org_supervisor'", "isOrgSupervisor: role === 'org_supervisor'"),
    ("isOrgEngineer: role === 'org_engineer'", "isOrgEngineer: role === 'org_engineer'"),
    ("isOrgTechnician: role === 'org_technician'", "isOrgTechnician: role === 'org_technician'"),
    ("isOrgAssistant: role === 'org_assistant'", "isOrgAssistant: role === 'org_assistant'"),
    ("isIndependent: role === 'independent'", "isIndependent: role === 'independent'"),
    
    # في السجلات والتعليقات
    ('isSystemOwner: customClaims.isSystemOwner', 'isSystemOwner: customClaims.isSystemOwner'),
    ('isSystemAdmin: customClaims.isSystemAdmin', 'isSystemAdmin: customClaims.isSystemAdmin'),
    ('isOrgOwner: customClaims.isOrgOwner', 'isOrgOwner: customClaims.isOrgOwner'),
    ('isOrgAdmin: customClaims.isOrgAdmin', 'isOrgAdmin: customClaims.isOrgAdmin'),
    ('isOrgSupervisor: customClaims.isOrgSupervisor', 'isOrgSupervisor: customClaims.isOrgSupervisor'),
    ('isOrgEngineer: customClaims.isOrgEngineer', 'isOrgEngineer: customClaims.isOrgEngineer'),
    ('isOrgTechnician: customClaims.isOrgTechnician', 'isOrgTechnician: customClaims.isOrgTechnician'),
    ('isOrgAssistant: customClaims.isOrgAssistant', 'isOrgAssistant: customClaims.isOrgAssistant'),
    ('isIndependent: customClaims.isIndependent', 'isIndependent: customClaims.isIndependent'),
    
    # الوصول للخصائص
    ('.isSystemOwner', '.isSystemOwner'),
    ('.isSystemAdmin', '.isSystemAdmin'),
    ('.isOrgOwner', '.isOrgOwner'),
    ('.isOrgAdmin', '.isOrgAdmin'),
    ('.isOrgSupervisor', '.isOrgSupervisor'),
    ('.isOrgEngineer', '.isOrgEngineer'),
    ('.isOrgTechnician', '.isOrgTechnician'),
    ('.isOrgAssistant', '.isOrgAssistant'),
    ('.isIndependent', '.isIndependent'),
    
    # في الشروط
    ('userClaims?.isSystemOwner', 'userClaims?.isSystemOwner'),
    ('userClaims?.isSystemAdmin', 'userClaims?.isSystemAdmin'),
    ('userClaims?.isOrgOwner', 'userClaims?.isOrgOwner'),
    ('userClaims?.isOrgAdmin', 'userClaims?.isOrgAdmin'),
    ('userClaims?.isOrgSupervisor', 'userClaims?.isOrgSupervisor'),
    ('userClaims?.isOrgEngineer', 'userClaims?.isOrgEngineer'),
    ('userClaims?.isOrgTechnician', 'userClaims?.isOrgTechnician'),
    ('userClaims?.isOrgAssistant', 'userClaims?.isOrgAssistant'),
    ('userClaims?.isIndependent', 'userClaims?.isIndependent'),
    
    # في التحقق من الصلاحيات
    ('userData.isSystemOwner', 'userData.isSystemOwner'),
    ('userData.isSystemAdmin', 'userData.isSystemAdmin'),
    ('userData.isOrgOwner', 'userData.isOrgOwner'),
    ('userData.isOrgAdmin', 'userData.isOrgAdmin'),
    ('userData.isOrgSupervisor', 'userData.isOrgSupervisor'),
    ('userData.isOrgEngineer', 'userData.isOrgEngineer'),
    ('userData.isOrgTechnician', 'userData.isOrgTechnician'),
    ('userData.isOrgAssistant', 'userData.isOrgAssistant'),
    ('userData.isIndependent', 'userData.isIndependent'),
    
    # في التعريفات
    ('isSystemOwner?:', 'isSystemOwner?:'),
    ('isSystemAdmin?:', 'isSystemAdmin?:'),
    ('isOrgOwner?:', 'isOrgOwner?:'),
    ('isOrgAdmin?:', 'isOrgAdmin?:'),
    ('isOrgSupervisor?:', 'isOrgSupervisor?:'),
    ('isOrgEngineer?:', 'isOrgEngineer?:'),
    ('isOrgTechnician?:', 'isOrgTechnician?:'),
    ('isOrgAssistant?:', 'isOrgAssistant?:'),
    ('isIndependent?:', 'isIndependent?:'),
    
    # === إزالة الأدوار المهجورة ===
    # إزالة admin و owner القديمة
    ('', ''),
    ('', ''),
    ('', ''),
    ('', ''),
    
    # === تحديث التعليقات ===
    ('// تم حذف النمط القديم', '// تم حذف النمط القديم'),
    ('// الصلاحيات الخاصة (النمط الجديد is* فقط)', '// الصلاحيات الخاصة (النمط الجديد is* فقط)'),
    
    # === إصلاح الأدوار في Python (Django) ===
    ("'org_admin'", "'org_admin'"),
    ("'org_owner'", "'org_owner'"),
    ('"org_admin"', '"org_admin"'),
    ('"org_owner"', '"org_owner"'),
    
    # === إصلاح الأدوار في التحقق من الصلاحيات ===
    ("role === 'org_admin'", "role === 'org_admin'"),
    ("role === 'org_owner'", "role === 'org_owner'"),
    ('role == "org_admin"', 'role == "org_admin"'),
    ('role == "org_owner"', 'role == "org_owner"'),
    
    # === إصلاح الأدوار في المصفوفات ===
    ("['org_admin',", "['org_admin',"),
    ("['org_owner',", "['org_owner',"),
    ('["org_admin",', '["org_admin",'),
    ('["org_owner",', '["org_owner",'),
    
    # === إصلاح الأدوار في الكائنات ===
    ("org_admin:", "org_admin:"),
    ("org_owner:", "org_owner:"),
    
    # === إزالة التوافق القديم ===
    ('|| userClaims?.role === \'admin\'', ''),
    ('|| userClaims?.role === \'owner\'', ''),
    ('|| userData?.role === \'admin\'', ''),
    ('|| userData?.role === \'owner\'', ''),
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

def process_file(file_path: Path) -> tuple[int, bool]:
    """معالجة ملف واحد وإرجاع عدد التغييرات وما إذا كان تم تعديل الملف"""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        original_content = content
        changes_count = 0
        
        # تطبيق جميع التحويلات
        for old_pattern, new_pattern in COMPREHENSIVE_REPLACEMENTS:
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
    print("🧹 بدء عملية التنظيف الشامل للأنماط القديمة...")
    print("=" * 60)
    
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
                print(f"✅ تم تنظيف: {relative_path} ({changes_count} تغيير)")
            
            total_files_processed += 1
    
    print("=" * 60)
    print("📊 ملخص التنظيف الشامل:")
    print(f"   📁 إجمالي الملفات المعالجة: {total_files_processed}")
    print(f"   🧹 الملفات المنظفة: {total_files_modified}")
    print(f"   🔄 إجمالي التغييرات: {total_changes}")
    
    if total_files_modified > 0:
        print("\n🎉 تم الانتهاء من التنظيف الشامل بنجاح!")
        print("💡 الآن النظام يستخدم النمط الجديد is* فقط بدون أي توافق قديم.")
        print("🔥 تم إزالة جميع الأدوار المهجورة (admin, owner) نهائياً.")
    else:
        print("\n✨ النظام نظيف بالفعل!")

if __name__ == "__main__":
    main()
