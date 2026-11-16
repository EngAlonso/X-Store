export const poultryTeamPermissionKeys = ['retail_sales', 'accountant', 'collector', 'customer_management'] as const;

export const poultryPermissionLabel: Record<string, string> = {
  retail_sales: 'بيع الدواجن بالكيلو',
  customer_management: 'إدارة العملاء',
  accountant: 'التقارير وكشوف الحساب',
  collector: 'تحصيل حسابات العملاء',
};

export const poultryPermissionDescription: Record<string, string> = {
  retail_sales: 'الوصول إلى قسم البيع وتسجيل فواتير الدواجن بالكيلو وحفظ سعر الكيلو.',
  customer_management: 'إضافة العملاء والبحث في بياناتهم دون البيع أو التحصيل.',
  accountant: 'عرض العملاء وكشوف الحساب والتقارير بدون إنشاء فواتير أو تحصيل.',
  collector: 'عرض حسابات العملاء وتسجيل التحصيل فقط، بدون إنشاء فاتورة.',
};
