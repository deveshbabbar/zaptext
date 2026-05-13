import { redirect } from 'next/navigation';
import { requireClientWithBots } from '@/lib/auth';
import { FlatCatalogEditor } from '@/components/client/flat-catalog-editor';
import { EcommerceProductsBulkImport } from '@/components/forms/bulk-import-buttons';

export default async function EcommerceProductsPage() {
  const user = await requireClientWithBots();
  if (!user.activeBot || user.activeBot.type !== 'ecommerce') redirect('/client/dashboard');
  return (
    <FlatCatalogEditor
      businessName={user.activeBot.business_name}
      crumbVertical="Ecommerce"
      crumbVerticalHref="/client/ecommerce"
      crumbLabel="Products"
      field="products"
      fields={[
        { key: 'sku', label: 'SKU', placeholder: 'SKU-001', colSpan: 2 },
        { key: 'name', label: 'Name', placeholder: 'Cotton Kurta', colSpan: 4 },
        { key: 'price', label: 'Price', placeholder: 'Rs.999 or S Rs.999 / M Rs.999 / L Rs.1099', colSpan: 6 },
        { key: 'mrp', label: 'MRP', placeholder: 'Rs.1,499', colSpan: 3 },
        { key: 'stock', label: 'Stock', placeholder: '25', type: 'number', colSpan: 2 },
        { key: 'category', label: 'Category', placeholder: 'Fashion', colSpan: 4 },
        { key: 'inStock', label: 'In stock', type: 'boolean', colSpan: 3 },
        { key: 'bestseller', label: 'Bestseller', type: 'boolean', colSpan: 3 },
        { key: 'description', label: 'Description', placeholder: 'Hand-block printed, M-XL', colSpan: 12 },
      ]}
      newItem={{ name: '', price: '', description: '', category: '', bestseller: false, inStock: true, sku: '', mrp: '', stock: 0 }}
      emptyHint="Bulk-import your product catalog from photo / paste / Excel — or add one manually."
      addLabel="Add product"
      BulkImport={EcommerceProductsBulkImport}
    />
  );
}
