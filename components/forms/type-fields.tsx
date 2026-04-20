'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { DynamicList } from './dynamic-list';
import { BusinessType, FAQ } from '@/lib/types';
import { FAQ_TEMPLATES } from '@/lib/constants';

interface TypeFieldsProps {
  type: BusinessType;
  data: Record<string, unknown>;
  onChange: (field: string, value: unknown) => void;
}

export function TypeFieldsForm({ type, data, onChange }: TypeFieldsProps) {
  switch (type) {
    case 'restaurant': return <RestaurantForm data={data} onChange={onChange} />;
    case 'coaching': return <CoachingForm data={data} onChange={onChange} />;
    case 'realestate': return <RealEstateForm data={data} onChange={onChange} />;
    case 'salon': return <SalonForm data={data} onChange={onChange} />;
    case 'd2c': return <D2CForm data={data} onChange={onChange} />;
    case 'gym': return <GymForm data={data} onChange={onChange} />;
  }
}

// ─── Restaurant Form ───
function RestaurantForm({ data, onChange }: { data: Record<string, unknown>; onChange: (f: string, v: unknown) => void }) {
  const menuCategories = (data.menuCategories as Array<Record<string, unknown>>) || [{ category: '', items: [{ name: '', price: '', description: '', isVeg: true, isBestseller: false }] }];
  const paymentMethods = (data.paymentMethods as string[]) || ['Cash', 'UPI'];

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold border-b border-border pb-2">Restaurant Details</h3>
      <div>
        <Label>Cuisine Type *</Label>
        <Input placeholder="North Indian, Chinese, Mughlai" value={(data.cuisineType as string) || ''} onChange={(e) => onChange('cuisineType', e.target.value)} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="flex items-center gap-3">
          <Switch checked={(data.deliveryAvailable as boolean) ?? true} onCheckedChange={(v) => onChange('deliveryAvailable', v)} />
          <Label>Delivery Available</Label>
        </div>
        <div>
          <Label>Delivery Radius</Label>
          <Input placeholder="5 km" value={(data.deliveryRadius as string) || ''} onChange={(e) => onChange('deliveryRadius', e.target.value)} />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <Label>Delivery Charges</Label>
          <Input placeholder="Rs.30 below Rs.300" value={(data.deliveryCharges as string) || ''} onChange={(e) => onChange('deliveryCharges', e.target.value)} />
        </div>
        <div>
          <Label>Minimum Order</Label>
          <Input placeholder="Rs.200" value={(data.minimumOrder as string) || ''} onChange={(e) => onChange('minimumOrder', e.target.value)} />
        </div>
        <div>
          <Label>Payment Methods</Label>
          <Input placeholder="Cash, UPI, Card" value={paymentMethods.join(', ')} onChange={(e) => onChange('paymentMethods', e.target.value.split(',').map((s) => s.trim()).filter(Boolean))} />
        </div>
      </div>

      <div>
        <Label>Special Offers</Label>
        <Input placeholder="20% off on orders above Rs.500" value={(data.specialOffers as string) || ''} onChange={(e) => onChange('specialOffers', e.target.value)} />
      </div>
      <div>
        <Label>Zomato/Swiggy Links</Label>
        <Input placeholder="https://zomato.com/..." value={(data.zomatoSwiggyLinks as string) || ''} onChange={(e) => onChange('zomatoSwiggyLinks', e.target.value)} />
      </div>

      <h3 className="text-lg font-semibold border-b border-border pb-2">Menu</h3>
      {menuCategories.map((cat, catIndex) => (
        <div key={catIndex} className="border border-border rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex-1 mr-4">
              <Label>Category Name</Label>
              <Input placeholder="Starters" value={(cat.category as string) || ''} onChange={(e) => {
                const updated = [...menuCategories];
                updated[catIndex] = { ...updated[catIndex], category: e.target.value };
                onChange('menuCategories', updated);
              }} />
            </div>
            {menuCategories.length > 1 && (
              <button type="button" onClick={() => onChange('menuCategories', menuCategories.filter((_, i) => i !== catIndex))} className="text-muted-foreground hover:text-destructive">x</button>
            )}
          </div>
          <DynamicList
            items={(cat.items as Array<Record<string, unknown>>) || []}
            onChange={(items) => {
              const updated = [...menuCategories];
              updated[catIndex] = { ...updated[catIndex], items };
              onChange('menuCategories', updated);
            }}
            newItem={() => ({ name: '', price: '', description: '', isVeg: true, isBestseller: false })}
            addLabel="Add Item"
            renderItem={(item, _, update) => (
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Item Name</Label>
                    <Input placeholder="Paneer Tikka" value={(item.name as string) || ''} onChange={(e) => update('name', e.target.value)} />
                  </div>
                  <div>
                    <Label>Price</Label>
                    <Input placeholder="Rs.249" value={(item.price as string) || ''} onChange={(e) => update('price', e.target.value)} />
                  </div>
                </div>
                <div>
                  <Label>Description</Label>
                  <Input placeholder="Marinated cottage cheese grilled in tandoor" value={(item.description as string) || ''} onChange={(e) => update('description', e.target.value)} />
                </div>
                <div>
                  <Label>Image URL (optional)</Label>
                  <Input placeholder="https://i.imgur.com/abc.jpg" value={(item.imageUrl as string) || ''} onChange={(e) => update('imageUrl', e.target.value)} />
                  <p className="text-[10px] text-muted-foreground mt-1">Upload to imgur.com or similar, paste public URL here</p>
                </div>
                <div className="flex gap-6 items-end flex-wrap">
                  <div>
                    <Label>Type</Label>
                    <div className="flex gap-2 mt-1">
                      {[
                        { key: 'veg', label: '🟢 Veg' },
                        { key: 'non-veg', label: '🔴 Non-Veg' },
                        { key: 'egg', label: '🟡 Egg' },
                      ].map((opt) => {
                        const currentType = (item as Record<string, unknown>).foodType as string | undefined;
                        const resolvedType = currentType || (item.isVeg ? 'veg' : 'non-veg');
                        const active = resolvedType === opt.key;
                        return (
                          <button
                            key={opt.key}
                            type="button"
                            onClick={() => {
                              update('foodType', opt.key);
                              update('isVeg', opt.key === 'veg');
                            }}
                            className={`px-3 py-1.5 rounded text-xs border transition-colors ${
                              active
                                ? 'bg-primary text-primary-foreground border-primary'
                                : 'bg-secondary border-border hover:border-primary/50'
                            }`}
                          >
                            {opt.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch checked={(item.isBestseller as boolean) ?? false} onCheckedChange={(v) => update('isBestseller', v)} />
                    <Label>Bestseller</Label>
                  </div>
                </div>
              </div>
            )}
          />
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange('menuCategories', [...menuCategories, { category: '', items: [{ name: '', price: '', description: '', isVeg: true, isBestseller: false }] }])}
        className="w-full border border-dashed border-border rounded-lg p-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        + Add Menu Category
      </button>
    </div>
  );
}

// ─── Coaching Form ───
function CoachingForm({ data, onChange }: { data: Record<string, unknown>; onChange: (f: string, v: unknown) => void }) {
  const courses = (data.coursesOffered as Array<Record<string, string>>) || [{ name: '', targetAudience: '', duration: '', fee: '', schedule: '', mode: '' }];

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold border-b border-border pb-2">Institute Details</h3>
      <div>
        <Label>Institute Name *</Label>
        <Input placeholder="Sharma Classes" value={(data.instituteName as string) || ''} onChange={(e) => onChange('instituteName', e.target.value)} />
      </div>
      <div>
        <Label>Faculty Info</Label>
        <Input placeholder="IIT/NIT alumni with 10+ years experience" value={(data.facultyInfo as string) || ''} onChange={(e) => onChange('facultyInfo', e.target.value)} />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label>Batch Size</Label>
          <Input placeholder="Max 30 students" value={(data.batchSize as string) || ''} onChange={(e) => onChange('batchSize', e.target.value)} />
        </div>
        <div className="flex items-center gap-3 pt-6">
          <Switch checked={(data.demoClassAvailable as boolean) ?? true} onCheckedChange={(v) => onChange('demoClassAvailable', v)} />
          <Label>Demo Class Available</Label>
        </div>
      </div>
      <div>
        <Label>Admission Process</Label>
        <Input placeholder="Fill form -> entrance test -> counseling" value={(data.admissionProcess as string) || ''} onChange={(e) => onChange('admissionProcess', e.target.value)} />
      </div>
      <div>
        <Label>Results / Achievements</Label>
        <Textarea placeholder="50+ IIT selections in 2025" value={(data.results as string) || ''} onChange={(e) => onChange('results', e.target.value)} rows={2} />
      </div>
      <div>
        <Label>Study Material</Label>
        <Input placeholder="Included in fee, DPPs + test series" value={(data.studyMaterial as string) || ''} onChange={(e) => onChange('studyMaterial', e.target.value)} />
      </div>

      <h3 className="text-lg font-semibold border-b border-border pb-2">Courses</h3>
      <DynamicList
        items={courses}
        onChange={(items) => onChange('coursesOffered', items)}
        newItem={() => ({ name: '', targetAudience: '', duration: '', fee: '', schedule: '', mode: '' })}
        addLabel="Add Course"
        renderItem={(item, _, update) => (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Course Name</Label>
              <Input placeholder="IIT-JEE Crash Course" value={item.name} onChange={(e) => update('name', e.target.value)} />
            </div>
            <div>
              <Label>Target Audience</Label>
              <Input placeholder="Class 11-12" value={item.targetAudience} onChange={(e) => update('targetAudience', e.target.value)} />
            </div>
            <div>
              <Label>Duration</Label>
              <Input placeholder="6 months" value={item.duration} onChange={(e) => update('duration', e.target.value)} />
            </div>
            <div>
              <Label>Fee</Label>
              <Input placeholder="Rs.45,000" value={item.fee} onChange={(e) => update('fee', e.target.value)} />
            </div>
            <div>
              <Label>Schedule</Label>
              <Input placeholder="Mon-Fri, 4-7 PM" value={item.schedule} onChange={(e) => update('schedule', e.target.value)} />
            </div>
            <div>
              <Label>Mode</Label>
              <Input placeholder="Offline + Online" value={item.mode} onChange={(e) => update('mode', e.target.value)} />
            </div>
          </div>
        )}
      />
    </div>
  );
}

// ─── Real Estate Form ───
function RealEstateForm({ data, onChange }: { data: Record<string, unknown>; onChange: (f: string, v: unknown) => void }) {
  const listings = (data.currentListings as Array<Record<string, string>>) || [{ title: '', type: '', price: '', area: '', highlights: '' }];
  const operatingAreas = (data.operatingAreas as string[]) || [];
  const propertyTypes = (data.propertyTypes as string[]) || [];
  const servicesList = (data.services as string[]) || ['Buy', 'Sell', 'Rent'];
  const banks = (data.homeLoanBanks as string[]) || [];

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold border-b border-border pb-2">Agent Details</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label>Agent Name *</Label>
          <Input placeholder="Rahul Verma" value={(data.agentName as string) || ''} onChange={(e) => onChange('agentName', e.target.value)} />
        </div>
        <div>
          <Label>RERA Number</Label>
          <Input placeholder="RERA/DL/..." value={(data.reraNumber as string) || ''} onChange={(e) => onChange('reraNumber', e.target.value)} />
        </div>
      </div>
      <div>
        <Label>Operating Areas (comma-separated)</Label>
        <Input placeholder="Dwarka, Gurgaon, Noida" value={operatingAreas.join(', ')} onChange={(e) => onChange('operatingAreas', e.target.value.split(',').map((s) => s.trim()).filter(Boolean))} />
      </div>
      <div>
        <Label>Property Types (comma-separated)</Label>
        <Input placeholder="2BHK, 3BHK, Villa, Commercial" value={propertyTypes.join(', ')} onChange={(e) => onChange('propertyTypes', e.target.value.split(',').map((s) => s.trim()).filter(Boolean))} />
      </div>
      <div>
        <Label>Services (comma-separated)</Label>
        <Input placeholder="Buy, Sell, Rent, Home Loan" value={servicesList.join(', ')} onChange={(e) => onChange('services', e.target.value.split(',').map((s) => s.trim()).filter(Boolean))} />
      </div>
      <div>
        <Label>Site Visit Process</Label>
        <Input placeholder="Book via WhatsApp, free cab pickup" value={(data.siteVisitProcess as string) || ''} onChange={(e) => onChange('siteVisitProcess', e.target.value)} />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="flex items-center gap-3">
          <Switch checked={(data.homeLoanAssistance as boolean) ?? false} onCheckedChange={(v) => onChange('homeLoanAssistance', v)} />
          <Label>Home Loan Assistance</Label>
        </div>
        <div>
          <Label>Partner Banks</Label>
          <Input placeholder="SBI, HDFC, ICICI" value={banks.join(', ')} onChange={(e) => onChange('homeLoanBanks', e.target.value.split(',').map((s) => s.trim()).filter(Boolean))} />
        </div>
      </div>

      <h3 className="text-lg font-semibold border-b border-border pb-2">Current Listings</h3>
      <DynamicList
        items={listings}
        onChange={(items) => onChange('currentListings', items)}
        newItem={() => ({ title: '', type: '', price: '', area: '', highlights: '' })}
        addLabel="Add Listing"
        renderItem={(item, _, update) => (
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Label>Title</Label>
              <Input placeholder="3BHK in Dwarka Sector 12" value={item.title} onChange={(e) => update('title', e.target.value)} />
            </div>
            <div>
              <Label>Type</Label>
              <Input placeholder="Apartment" value={item.type} onChange={(e) => update('type', e.target.value)} />
            </div>
            <div>
              <Label>Price</Label>
              <Input placeholder="Rs.1.2 Cr" value={item.price} onChange={(e) => update('price', e.target.value)} />
            </div>
            <div>
              <Label>Area</Label>
              <Input placeholder="1450 sq ft" value={item.area} onChange={(e) => update('area', e.target.value)} />
            </div>
            <div>
              <Label>Highlights</Label>
              <Input placeholder="Near metro, gated society" value={item.highlights} onChange={(e) => update('highlights', e.target.value)} />
            </div>
          </div>
        )}
      />
    </div>
  );
}

// ─── Salon Form ───
function SalonForm({ data, onChange }: { data: Record<string, unknown>; onChange: (f: string, v: unknown) => void }) {
  const services = (data.services as Array<Record<string, unknown>>) || [{ category: '', items: [{ name: '', price: '', duration: '' }] }];
  const packages = (data.packages as Array<Record<string, string>>) || [{ name: '', includes: '', price: '' }];
  const brands = (data.brands as string[]) || [];

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold border-b border-border pb-2">Salon Details</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label>Salon Name *</Label>
          <Input placeholder="Glamour Studio" value={(data.salonName as string) || ''} onChange={(e) => onChange('salonName', e.target.value)} />
        </div>
        <div>
          <Label>Type</Label>
          <div className="flex gap-2 mt-1">
            {['Unisex', 'Women only', 'Men only'].map((g) => (
              <button key={g} type="button" onClick={() => onChange('gender', g)}
                className={`px-3 py-1.5 rounded text-sm border transition-colors ${(data.gender as string) === g ? 'bg-primary text-primary-foreground border-primary' : 'bg-secondary border-border'}`}>
                {g}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div>
        <Label>Brands Used (comma-separated)</Label>
        <Input placeholder="L'Oreal, Schwarzkopf, Wella" value={brands.join(', ')} onChange={(e) => onChange('brands', e.target.value.split(',').map((s) => s.trim()).filter(Boolean))} />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="flex items-center gap-3">
          <Switch checked={(data.bookingRequired as boolean) ?? true} onCheckedChange={(v) => onChange('bookingRequired', v)} />
          <Label>Booking Required</Label>
        </div>
        <div className="flex items-center gap-3">
          <Switch checked={(data.homeServiceAvailable as boolean) ?? false} onCheckedChange={(v) => onChange('homeServiceAvailable', v)} />
          <Label>Home Service</Label>
        </div>
        <div>
          <Label>Home Service Charges</Label>
          <Input placeholder="Rs.200 extra" value={(data.homeServiceCharges as string) || ''} onChange={(e) => onChange('homeServiceCharges', e.target.value)} />
        </div>
      </div>

      <h3 className="text-lg font-semibold border-b border-border pb-2">Services</h3>
      {services.map((cat, catIndex) => (
        <div key={catIndex} className="border border-border rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex-1 mr-4">
              <Label>Category (e.g., Hair, Skin, Nails)</Label>
              <Input placeholder="Hair" value={(cat.category as string) || ''} onChange={(e) => {
                const updated = [...services];
                updated[catIndex] = { ...updated[catIndex], category: e.target.value };
                onChange('services', updated);
              }} />
            </div>
            {services.length > 1 && (
              <button type="button" onClick={() => onChange('services', services.filter((_, i) => i !== catIndex))} className="text-muted-foreground hover:text-destructive">x</button>
            )}
          </div>
          <DynamicList
            items={(cat.items as Array<Record<string, string>>) || []}
            onChange={(items) => {
              const updated = [...services];
              updated[catIndex] = { ...updated[catIndex], items };
              onChange('services', updated);
            }}
            newItem={() => ({ name: '', price: '', duration: '' })}
            addLabel="Add Service"
            renderItem={(item, _, update) => (
              <div className="grid grid-cols-3 gap-3">
                <div><Label>Name</Label><Input placeholder="Hair Smoothening" value={item.name} onChange={(e) => update('name', e.target.value)} /></div>
                <div><Label>Price</Label><Input placeholder="Rs.3,500" value={item.price} onChange={(e) => update('price', e.target.value)} /></div>
                <div><Label>Duration</Label><Input placeholder="2-3 hours" value={item.duration} onChange={(e) => update('duration', e.target.value)} /></div>
              </div>
            )}
          />
        </div>
      ))}
      <button type="button" onClick={() => onChange('services', [...services, { category: '', items: [{ name: '', price: '', duration: '' }] }])}
        className="w-full border border-dashed border-border rounded-lg p-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
        + Add Service Category
      </button>

      <h3 className="text-lg font-semibold border-b border-border pb-2">Packages</h3>
      <DynamicList
        items={packages}
        onChange={(items) => onChange('packages', items)}
        newItem={() => ({ name: '', includes: '', price: '' })}
        addLabel="Add Package"
        renderItem={(item, _, update) => (
          <div className="grid grid-cols-3 gap-3">
            <div><Label>Package Name</Label><Input placeholder="Bridal Package" value={item.name} onChange={(e) => update('name', e.target.value)} /></div>
            <div><Label>Includes</Label><Input placeholder="Makeup + Hair + Draping" value={item.includes} onChange={(e) => update('includes', e.target.value)} /></div>
            <div><Label>Price</Label><Input placeholder="Rs.25,000" value={item.price} onChange={(e) => update('price', e.target.value)} /></div>
          </div>
        )}
      />
    </div>
  );
}

// ─── D2C Form ───
function D2CForm({ data, onChange }: { data: Record<string, unknown>; onChange: (f: string, v: unknown) => void }) {
  const products = (data.products as Array<Record<string, unknown>>) || [{ name: '', price: '', description: '', bestseller: false }];
  const paymentMethods = (data.paymentMethods as string[]) || ['UPI', 'Card', 'COD'];

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold border-b border-border pb-2">Brand Details</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label>Brand Name *</Label>
          <Input placeholder="GlowUp Skincare" value={(data.brandName as string) || ''} onChange={(e) => onChange('brandName', e.target.value)} />
        </div>
        <div>
          <Label>Product Category *</Label>
          <Input placeholder="Skincare / Fashion / Food" value={(data.productCategory as string) || ''} onChange={(e) => onChange('productCategory', e.target.value)} />
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label>Website URL</Label>
          <Input placeholder="https://glowup.in" value={(data.websiteUrl as string) || ''} onChange={(e) => onChange('websiteUrl', e.target.value)} />
        </div>
        <div>
          <Label>Instagram Handle</Label>
          <Input placeholder="@glowup.skincare" value={(data.instagramHandle as string) || ''} onChange={(e) => onChange('instagramHandle', e.target.value)} />
        </div>
      </div>
      <div>
        <Label>Shipping Policy</Label>
        <Input placeholder="Free delivery above Rs.499, 3-5 days" value={(data.shippingPolicy as string) || ''} onChange={(e) => onChange('shippingPolicy', e.target.value)} />
      </div>
      <div>
        <Label>Return Policy</Label>
        <Input placeholder="7-day easy returns, no questions asked" value={(data.returnPolicy as string) || ''} onChange={(e) => onChange('returnPolicy', e.target.value)} />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="flex items-center gap-3">
          <Switch checked={(data.codAvailable as boolean) ?? true} onCheckedChange={(v) => onChange('codAvailable', v)} />
          <Label>COD Available</Label>
        </div>
        <div className="col-span-2">
          <Label>Payment Methods</Label>
          <Input placeholder="UPI, Card, COD" value={paymentMethods.join(', ')} onChange={(e) => onChange('paymentMethods', e.target.value.split(',').map((s) => s.trim()).filter(Boolean))} />
        </div>
      </div>
      <div>
        <Label>Current Offers</Label>
        <Input placeholder="Buy 2 Get 1 Free on all serums" value={(data.currentOffers as string) || ''} onChange={(e) => onChange('currentOffers', e.target.value)} />
      </div>
      <div>
        <Label>Order Tracking Process</Label>
        <Input placeholder="Share order ID, we'll send tracking link" value={(data.orderTrackingProcess as string) || ''} onChange={(e) => onChange('orderTrackingProcess', e.target.value)} />
      </div>

      <h3 className="text-lg font-semibold border-b border-border pb-2">Products</h3>
      <DynamicList
        items={products}
        onChange={(items) => onChange('products', items)}
        newItem={() => ({ name: '', price: '', description: '', bestseller: false })}
        addLabel="Add Product"
        renderItem={(item, _, update) => (
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Product Name</Label><Input placeholder="Vitamin C Serum" value={(item.name as string) || ''} onChange={(e) => update('name', e.target.value)} /></div>
              <div><Label>Price</Label><Input placeholder="Rs.599" value={(item.price as string) || ''} onChange={(e) => update('price', e.target.value)} /></div>
            </div>
            <div><Label>Description</Label><Input placeholder="Brightening serum with 20% Vitamin C" value={(item.description as string) || ''} onChange={(e) => update('description', e.target.value)} /></div>
            <div>
              <Label>Image URL (optional)</Label>
              <Input placeholder="https://i.imgur.com/abc.jpg" value={(item.imageUrl as string) || ''} onChange={(e) => update('imageUrl', e.target.value)} />
              <p className="text-[10px] text-muted-foreground mt-1">Upload to imgur.com or similar, paste public URL here</p>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={(item.bestseller as boolean) ?? false} onCheckedChange={(v) => update('bestseller', v)} />
              <Label>Bestseller</Label>
            </div>
          </div>
        )}
      />
    </div>
  );
}

// ─── Gym Form ───
function GymForm({ data, onChange }: { data: Record<string, unknown>; onChange: (f: string, v: unknown) => void }) {
  const plans = (data.membershipPlans as Array<Record<string, string>>) || [{ name: '', duration: '', price: '', includes: '' }];
  const facilities = (data.facilities as string[]) || [];
  const classes = (data.groupClasses as string[]) || [];
  const pt = (data.personalTraining as Record<string, unknown>) || { available: false, pricePerSession: '', trainerInfo: '' };

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold border-b border-border pb-2">Gym Details</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Label>Gym Name *</Label>
          <Input placeholder="Iron Paradise Gym" value={(data.gymName as string) || ''} onChange={(e) => onChange('gymName', e.target.value)} />
        </div>
        <div>
          <Label>Timings *</Label>
          <Input placeholder="5 AM - 11 PM, 365 days" value={(data.timings as string) || ''} onChange={(e) => onChange('timings', e.target.value)} />
        </div>
      </div>
      <div>
        <Label>Facilities (comma-separated)</Label>
        <Input placeholder="Cardio Zone, Weight Training, Steam Bath, Locker Room" value={facilities.join(', ')} onChange={(e) => onChange('facilities', e.target.value.split(',').map((s) => s.trim()).filter(Boolean))} />
      </div>
      <div>
        <Label>Group Classes (comma-separated)</Label>
        <Input placeholder="Yoga, Zumba, CrossFit, Boxing" value={classes.join(', ')} onChange={(e) => onChange('groupClasses', e.target.value.split(',').map((s) => s.trim()).filter(Boolean))} />
      </div>

      <h3 className="text-lg font-semibold border-b border-border pb-2">Personal Training</h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="flex items-center gap-3">
          <Switch checked={(pt.available as boolean) ?? false} onCheckedChange={(v) => onChange('personalTraining', { ...pt, available: v })} />
          <Label>Available</Label>
        </div>
        <div>
          <Label>Price per Session</Label>
          <Input placeholder="Rs.500/session" value={(pt.pricePerSession as string) || ''} onChange={(e) => onChange('personalTraining', { ...pt, pricePerSession: e.target.value })} />
        </div>
        <div>
          <Label>Trainer Info</Label>
          <Input placeholder="Certified, 5+ years" value={(pt.trainerInfo as string) || ''} onChange={(e) => onChange('personalTraining', { ...pt, trainerInfo: e.target.value })} />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="flex items-center gap-3">
          <Switch checked={(data.trialAvailable as boolean) ?? true} onCheckedChange={(v) => onChange('trialAvailable', v)} />
          <Label>Free Trial Available</Label>
        </div>
        <div>
          <Label>Trial Details</Label>
          <Input placeholder="3-day free trial, no card required" value={(data.trialDetails as string) || ''} onChange={(e) => onChange('trialDetails', e.target.value)} />
        </div>
      </div>

      <h3 className="text-lg font-semibold border-b border-border pb-2">Membership Plans</h3>
      <DynamicList
        items={plans}
        onChange={(items) => onChange('membershipPlans', items)}
        newItem={() => ({ name: '', duration: '', price: '', includes: '' })}
        addLabel="Add Plan"
        renderItem={(item, _, update) => (
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Plan Name</Label><Input placeholder="Monthly" value={item.name} onChange={(e) => update('name', e.target.value)} /></div>
            <div><Label>Duration</Label><Input placeholder="1 month" value={item.duration} onChange={(e) => update('duration', e.target.value)} /></div>
            <div><Label>Price</Label><Input placeholder="Rs.2,000" value={item.price} onChange={(e) => update('price', e.target.value)} /></div>
            <div><Label>Includes</Label><Input placeholder="Gym access + 1 class/day" value={item.includes} onChange={(e) => update('includes', e.target.value)} /></div>
          </div>
        )}
      />
    </div>
  );
}
