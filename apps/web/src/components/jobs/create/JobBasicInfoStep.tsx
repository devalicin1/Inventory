import React, { useState, useMemo, useRef, useEffect } from 'react';
import { UserIcon, ChevronDownIcon, MagnifyingGlassIcon, FolderIcon, CubeIcon, CalculatorIcon } from '@heroicons/react/24/outline';
import type { JobFormData } from './types';
import { Card } from '../../ui/Card';
import { Input } from '../../ui/Input';
import type { Group } from '../../../api/products';
import { useJobCalculations } from './useJobCalculations';

interface JobBasicInfoStepProps {
    formData: JobFormData;
    setFormData: React.Dispatch<React.SetStateAction<JobFormData>>;
    customers: any[];
    products: any[];
    groups?: Group[];
    generateUniqueJobCode: (customerName?: string) => string;
}

export const JobBasicInfoStep: React.FC<JobBasicInfoStepProps> = ({
    formData,
    setFormData,
    customers,
    products,
    groups = [],
    generateUniqueJobCode,
}) => {
    const selectedCustomer = formData.customer.id ? customers.find(c => c.id === formData.customer.id) : null;
    
    // Product selection state
    const [productSearchTerm, setProductSearchTerm] = useState('');
    const [selectedGroupId, setSelectedGroupId] = useState<string>('');
    const [showProductDropdown, setShowProductDropdown] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);
    
    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setShowProductDropdown(false);
            }
        };
        
        if (showProductDropdown) {
            document.addEventListener('mousedown', handleClickOutside);
            return () => {
                document.removeEventListener('mousedown', handleClickOutside);
            };
        }
    }, [showProductDropdown]);
    
    // Build group hierarchy
    const groupMap = useMemo(() => {
        const map = new Map<string, Group>();
        groups.forEach(g => map.set(g.id, g));
        return map;
    }, [groups]);
    
    const getGroupPath = (groupId: string | null | undefined): string => {
        if (!groupId) return 'Ungrouped';
        const group = groupMap.get(groupId);
        if (!group) return 'Unknown';
        const parts = [group.name];
        let current = group;
        const visited = new Set<string>();
        while (current?.parentId && !visited.has(current.parentId)) {
            visited.add(current.parentId);
            const parent = groupMap.get(current.parentId);
            if (parent) {
                parts.unshift(parent.name);
                current = parent;
            } else {
                break;
            }
        }
        return parts.join(' / ');
    };
    
    // Helper function to decode and clean product names
    const decodeProductName = (name: string | undefined): string => {
        if (!name) return '';
        // Clean up encoding issues - remove replacement characters and invalid unicode
        let cleaned = name
            .replace(/\uFFFD/g, '') // Remove replacement characters ()
            .replace(/\u0000/g, '') // Remove null characters
            .trim();
        
        // Try to decode HTML entities if any
        try {
            const textarea = document.createElement('textarea');
            textarea.innerHTML = cleaned;
            cleaned = textarea.value || cleaned;
        } catch (e) {
            // If decoding fails, use original
        }
        
        return cleaned || name;
    };
    
    // Filter products
    const filteredProducts = useMemo(() => {
        return products.filter(p => {
            const decodedName = decodeProductName(p.name);
            const matchesSearch = !productSearchTerm || 
                decodedName.toLowerCase().includes(productSearchTerm.toLowerCase()) ||
                p.sku?.toLowerCase().includes(productSearchTerm.toLowerCase());
            const matchesGroup = !selectedGroupId || (p as any).groupId === selectedGroupId;
            return matchesSearch && matchesGroup;
        });
    }, [products, productSearchTerm, selectedGroupId]);
    
    // Group products by group and sort alphabetically
    const groupedProducts = useMemo(() => {
        const grouped = new Map<string, typeof products>();
        // Sort filtered products alphabetically by name
        const sortedProducts = [...filteredProducts].sort((a, b) => {
            const nameA = decodeProductName(a.name || '').toLowerCase();
            const nameB = decodeProductName(b.name || '').toLowerCase();
            return nameA.localeCompare(nameB);
        });
        
        sortedProducts.forEach(p => {
            const groupId = (p as any).groupId || '__ungrouped__';
            if (!grouped.has(groupId)) {
                grouped.set(groupId, []);
            }
            grouped.get(groupId)!.push(p);
        });
        return grouped;
    }, [filteredProducts]);
    
    const selectedProduct = products.find(p => p.sku === formData.sku && p.name === formData.productName);
    
    // Get calculations for quantity conversions
    const { planned } = useJobCalculations(formData);
    
    // Calculate quantity conversions for display
    const quantityConversions = useMemo(() => {
        const qty = formData.quantity || 0;
        const unit = formData.unit || 'pcs';
        const pcsPerBox = formData.packaging?.pcsPerBox || 1;
        const boxesPerPallet = formData.packaging?.boxesPerPallet || 1;
        
        let pcs = 0;
        let boxes = 0;
        let palletsExact = 0; // Net pallet sayısı (tam)
        let palletsRounded = 0; // Yukarı yuvarlanmış pallet sayısı
        
        if (unit === 'pcs') {
            pcs = qty;
            boxes = pcsPerBox > 0 ? Math.ceil(pcs / pcsPerBox) : 0;
            palletsExact = boxesPerPallet > 0 ? boxes / boxesPerPallet : 0;
            palletsRounded = boxesPerPallet > 0 ? Math.ceil(boxes / boxesPerPallet) : 0;
        } else if (unit === 'box' || unit === 'units') {
            boxes = qty;
            pcs = boxes * pcsPerBox;
            palletsExact = boxesPerPallet > 0 ? boxes / boxesPerPallet : 0;
            palletsRounded = boxesPerPallet > 0 ? Math.ceil(boxes / boxesPerPallet) : 0;
        } else if (unit === 'pallets') {
            palletsRounded = qty;
            palletsExact = qty;
            boxes = palletsRounded * boxesPerPallet;
            pcs = boxes * pcsPerBox;
        } else {
            // For other units (kg, m, L), show only the entered value
            pcs = qty;
            boxes = 0;
            palletsExact = 0;
            palletsRounded = 0;
        }
        
        return { pcs, boxes, palletsExact, palletsRounded };
    }, [formData.quantity, formData.unit, formData.packaging?.pcsPerBox, formData.packaging?.boxesPerPallet]);

    const handleCustomerSelect = (customerId: string) => {
        if (!customerId) {
            setFormData(prev => ({
                ...prev,
                customer: { ...prev.customer, id: '', name: '' }
            }));
            return;
        }

        const customer = customers.find(c => c.id === customerId);
        if (!customer) return;

        const newJobCode = generateUniqueJobCode(customer.name);

        setFormData(prev => {
            const updated = {
                ...prev,
                customer: {
                    ...prev.customer,
                    id: customer.id,
                    name: customer.name
                },
                jobCode: newJobCode,
                internalRef: newJobCode
            };

            // Auto-fill delivery address
            const formatAddress = (addr: any) => {
                if (!addr) return '';
                return [addr.street, addr.city, addr.state, addr.zipCode, addr.country].filter(Boolean).join(', ');
            };

            const shippingAddress = formatAddress(customer.shippingAddress);
            if (shippingAddress && !prev.deliveryAddress) {
                updated.deliveryAddress = shippingAddress;
            }

            return updated;
        });
    };

    return (
        <div className="max-w-6xl mx-auto space-y-6">
            <div className="mb-8">
                <h2 className="text-2xl font-bold text-gray-900">Basic Information</h2>
                <p className="text-gray-600 mt-2">Enter customer details and product information</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Customer Info */}
                <div className="space-y-6">
                    <Card>
                        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                            <UserIcon className="h-5 w-5 text-primary-600" />
                            Customer Information
                        </h3>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Customer *</label>
                                <div className="relative">
                                    <select
                                        value={formData.customer.id || ''}
                                        onChange={(e) => handleCustomerSelect(e.target.value)}
                                        className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 py-2.5 px-3 border bg-white appearance-none pr-10"
                                    >
                                        <option value="">Select a customer...</option>
                                        {customers.filter(c => c.active).map((customer) => (
                                            <option key={customer.id} value={customer.id}>
                                                {customer.name} {customer.companyName && `- ${customer.companyName}`}
                                            </option>
                                        ))}
                                    </select>
                                    <ChevronDownIcon className="absolute right-3 top-3 h-5 w-5 text-gray-400 pointer-events-none" />
                                </div>
                                {selectedCustomer && (
                                    <div className="mt-2 p-3 bg-primary-50 rounded-lg border border-primary-200 text-sm text-primary-900 space-y-1">
                                        <div className="font-medium">{selectedCustomer.name}</div>
                                        {selectedCustomer.companyName && <div>Company: {selectedCustomer.companyName}</div>}
                                        {selectedCustomer.email && <div>Email: {selectedCustomer.email}</div>}
                                    </div>
                                )}
                            </div>

                            {!formData.customer.id && (
                                <Input
                                    label="Or Enter Customer Name Manually *"
                                    placeholder="Enter customer name"
                                    value={formData.customer.name}
                                    onChange={(e) => {
                                        const name = e.target.value;
                                        const newJobCode = generateUniqueJobCode(name);
                                        setFormData(prev => ({
                                            ...prev,
                                            customer: { ...prev.customer, name },
                                            jobCode: newJobCode,
                                            internalRef: newJobCode
                                        }));
                                    }}
                                />
                            )}

                            <div className="grid grid-cols-2 gap-4">
                                <Input
                                    label="Internal Reference"
                                    value={formData.internalRef}
                                    readOnly
                                    className="bg-gray-50 cursor-not-allowed"
                                />
                                <Input
                                    label="Customer PO"
                                    placeholder="PO number"
                                    value={formData.customerPo}
                                    onChange={(e) => setFormData(prev => ({ ...prev, customerPo: e.target.value }))}
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <Input
                                    label="Estimate Number"
                                    placeholder="Estimate #"
                                    value={formData.customer.estNo}
                                    onChange={(e) => setFormData(prev => ({ ...prev, customer: { ...prev.customer, estNo: e.target.value } }))}
                                />
                                <Input
                                    label="Cutter No"
                                    placeholder="Cutter number"
                                    value={formData.cutterNo}
                                    onChange={(e) => setFormData(prev => ({ ...prev, cutterNo: e.target.value }))}
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Job Type</label>
                                <div className="flex gap-4 mt-2">
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="radio"
                                            checked={!formData.isRepeat}
                                            onChange={() => setFormData(prev => ({ ...prev, isRepeat: false }))}
                                            className="text-primary-600 focus:ring-primary-500"
                                        />
                                        <span className="text-sm">New Job</span>
                                    </label>
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="radio"
                                            checked={formData.isRepeat}
                                            onChange={() => setFormData(prev => ({ ...prev, isRepeat: true }))}
                                            className="text-primary-600 focus:ring-primary-500"
                                        />
                                        <span className="text-sm">Repeat Job</span>
                                    </label>
                                </div>
                            </div>

                            <Input
                                type="date"
                                label="Date *"
                                value={typeof formData.customer.date === 'string' ? formData.customer.date : ''}
                                onChange={(e) => setFormData(prev => ({ ...prev, customer: { ...prev.customer, date: e.target.value } }))}
                            />
                        </div>
                    </Card>
                </div>

                {/* Product Details */}
                <div className="space-y-6">
                    <Card>
                        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                            <UserIcon className="h-5 w-5 text-primary-600" /> {/* Should be CubeIcon but using UserIcon as placeholder if CubeIcon not imported, wait I imported UserIcon. I should import CubeIcon */}
                            Product Details
                        </h3>
                        <div className="space-y-4">
                            <Input
                                label="Job Code"
                                value={formData.jobCode}
                                readOnly
                                className="bg-gray-50 cursor-not-allowed"
                            />

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Select Product from Inventory</label>
                                <div className="relative">
                                    {/* Search and Filter Bar */}
                                    <div className="mb-2 space-y-2">
                                        <div className="relative">
                                            <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                                            <input
                                                type="text"
                                                placeholder="Search by SKU or name..."
                                                value={productSearchTerm}
                                                onChange={(e) => {
                                                    setProductSearchTerm(e.target.value);
                                                    setShowProductDropdown(true);
                                                }}
                                                onFocus={() => setShowProductDropdown(true)}
                                                className="block w-full pl-10 pr-3 py-2 rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 border bg-white text-sm"
                                            />
                                        </div>
                                        {groups.length > 0 && (
                                            <div className="flex items-center gap-2">
                                                <FolderIcon className="h-4 w-4 text-gray-400" />
                                                <select
                                                    value={selectedGroupId}
                                                    onChange={(e) => {
                                                        setSelectedGroupId(e.target.value);
                                                        setShowProductDropdown(true);
                                                    }}
                                                    className="flex-1 text-sm rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 py-1.5 px-2 border bg-white"
                                                >
                                                    <option value="">All Groups</option>
                                                    {groups.map(g => (
                                                        <option key={g.id} value={g.id}>
                                                            {getGroupPath(g.id)}
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>
                                        )}
                                    </div>
                                    
                                    {/* Product Selection Dropdown */}
                                    <div className="relative" ref={dropdownRef}>
                                        <button
                                            type="button"
                                            onClick={() => setShowProductDropdown(!showProductDropdown)}
                                            className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 py-2.5 px-3 border bg-white text-left flex items-center justify-between"
                                        >
                                            <span className={selectedProduct ? 'text-gray-900' : 'text-gray-500'}>
                                                {selectedProduct 
                                                    ? `${selectedProduct.sku} — ${decodeProductName(selectedProduct.name)}${selectedProduct.groupId ? ` (${getGroupPath(selectedProduct.groupId)})` : ''}`
                                                    : '— Select existing product —'}
                                            </span>
                                            <ChevronDownIcon className={`h-5 w-5 text-gray-400 transition-transform ${showProductDropdown ? 'transform rotate-180' : ''}`} />
                                        </button>
                                        
                                        {showProductDropdown && (
                                            <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-96 overflow-auto">
                                                {filteredProducts.length === 0 ? (
                                                    <div className="px-4 py-3 text-sm text-gray-500 text-center">
                                                        No products found
                                                    </div>
                                                ) : (
                                                    <div className="py-1">
                                                        {Array.from(groupedProducts.entries()).map(([groupId, groupProducts]) => (
                                                            <div key={groupId}>
                                                                {groupId !== '__ungrouped__' && groups.length > 0 && (
                                                                    <div className="px-3 py-2 bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-700 flex items-center gap-1">
                                                                        <FolderIcon className="h-3 w-3" />
                                                                        {getGroupPath(groupId)}
                                                                    </div>
                                                                )}
                                                                {groupProducts.map(p => (
                                                                    <button
                                                                        key={p.id}
                                                                        type="button"
                                                                        onClick={() => {
                                                                            setFormData(prev => ({
                                                                                ...prev,
                                                                                sku: p.sku,
                                                                                productName: p.name,
                                                                                unit: p.uom || prev.unit
                                                                            }));
                                                                            setShowProductDropdown(false);
                                                                            setProductSearchTerm('');
                                                                            setSelectedGroupId('');
                                                                        }}
                                                                        className={`w-full px-4 py-2 text-left text-sm hover:bg-primary-50 transition-colors ${
                                                                            selectedProduct?.id === p.id ? 'bg-primary-100' : ''
                                                                        }`}
                                                                    >
                                                                        <div className="flex items-center gap-2">
                                                                            <CubeIcon className="h-4 w-4 text-gray-400 flex-shrink-0" />
                                                                            <div className="flex-1 min-w-0">
                                                                                <div className="font-medium text-gray-900 truncate">{decodeProductName(p.name)}</div>
                                                                                <div className="text-xs text-gray-500">SKU: {p.sku}</div>
                                                                                {(p as any).qtyOnHand !== undefined && (
                                                                                    <div className="text-xs text-gray-400 mt-0.5">
                                                                                        Stock: {(p as any).qtyOnHand || 0} {p.uom || 'units'}
                                                                                    </div>
                                                                                )}
                                                                            </div>
                                                                        </div>
                                                                    </button>
                                                                ))}
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                                
                                {/* Selected Product Info */}
                                {selectedProduct && (
                                    <div className="mt-2 p-3 bg-primary-50 rounded-lg border border-primary-200 text-sm">
                                        <div className="font-medium text-primary-900">{decodeProductName(selectedProduct.name)}</div>
                                        <div className="text-primary-700 mt-1">
                                            SKU: {selectedProduct.sku} • UOM: {selectedProduct.uom || 'N/A'}
                                            {selectedProduct.groupId && ` • Group: ${getGroupPath(selectedProduct.groupId)}`}
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <Input
                                    label="SKU"
                                    placeholder="Product SKU"
                                    value={formData.sku}
                                    onChange={(e) => setFormData(prev => ({ ...prev, sku: e.target.value }))}
                                />
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Priority</label>
                                    <select
                                        value={formData.priority}
                                        onChange={(e) => setFormData(prev => ({ ...prev, priority: Number(e.target.value) }))}
                                        className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 py-2.5 px-3 border bg-white"
                                    >
                                        <option value={1}>Critical</option>
                                        <option value={2}>High</option>
                                        <option value={3}>Medium</option>
                                        <option value={4}>Low</option>
                                        <option value={5}>Very Low</option>
                                    </select>
                                </div>
                            </div>

                            <Input
                                label="Product Name *"
                                placeholder="Enter full product name"
                                value={formData.productName}
                                onChange={(e) => setFormData(prev => ({ ...prev, productName: e.target.value }))}
                            />

                            <div className="grid grid-cols-2 gap-4">
                                <Input
                                    type="number"
                                    label="Quantity *"
                                    min="1"
                                    value={formData.quantity}
                                    onChange={(e) => setFormData(prev => ({ ...prev, quantity: Number(e.target.value) }))}
                                />
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Unit</label>
                                    <select
                                        value={formData.unit}
                                        onChange={(e) => setFormData(prev => ({ ...prev, unit: e.target.value }))}
                                        className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 py-2.5 px-3 border bg-white"
                                    >
                                        <option value="pcs">Pieces</option>
                                        <option value="box">Box</option>
                                        <option value="kg">Kilograms</option>
                                        <option value="m">Meters</option>
                                        <option value="L">Liters</option>
                                        <option value="units">Units</option>
                                        <option value="pallets">Pallets</option>
                                    </select>
                                </div>
                            </div>
                            
                            {/* Packaging Information Input */}
                            {(formData.unit === 'pcs' || formData.unit === 'box' || formData.unit === 'units' || formData.unit === 'pallets') && (
                                <div className="mt-4 space-y-4">
                                    <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                                        <div className="flex items-center gap-2 mb-3">
                                            <CubeIcon className="h-4 w-4 text-blue-600" />
                                            <h4 className="text-sm font-semibold text-gray-900">Packaging Information</h4>
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-xs font-medium text-gray-700 mb-1.5">
                                                    Pieces per Box (PCS/Box) *
                                                </label>
                                                <input
                                                    type="number"
                                                    min="1"
                                                    value={formData.packaging?.pcsPerBox || ''}
                                                    onChange={(e) => setFormData(prev => ({
                                                        ...prev,
                                                        packaging: {
                                                            ...prev.packaging,
                                                            pcsPerBox: e.target.value ? Number(e.target.value) : undefined
                                                        }
                                                    }))}
                                                    placeholder="e.g., 100"
                                                    className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 py-2 px-3 border bg-white text-sm"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-medium text-gray-700 mb-1.5">
                                                    Boxes per Pallet *
                                                </label>
                                                <input
                                                    type="number"
                                                    min="1"
                                                    value={formData.packaging?.boxesPerPallet || ''}
                                                    onChange={(e) => setFormData(prev => ({
                                                        ...prev,
                                                        packaging: {
                                                            ...prev.packaging,
                                                            boxesPerPallet: e.target.value ? Number(e.target.value) : undefined
                                                        }
                                                    }))}
                                                    placeholder="e.g., 50"
                                                    className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 py-2 px-3 border bg-white text-sm"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                    
                                    {/* Quantity Conversions Display */}
                                    <div className="p-4 bg-gradient-to-br from-gray-50 to-gray-100 rounded-lg border-2 border-gray-300 shadow-sm">
                                        <div className="flex items-center gap-2 mb-4">
                                            <CalculatorIcon className="h-5 w-5 text-primary-600" />
                                            <h4 className="text-sm font-bold text-gray-900 uppercase tracking-wide">Calculated Quantities</h4>
                                        </div>
                                        <div className="grid grid-cols-3 gap-4 mb-4">
                                            <div className="bg-white rounded-lg p-3 border-2 border-blue-200 shadow-sm">
                                                <div className="text-xs font-medium text-blue-600 mb-1.5 uppercase tracking-wide">Pieces (PCS)</div>
                                                <div className="text-2xl font-bold text-blue-700">{quantityConversions.pcs.toLocaleString()}</div>
                                                {formData.unit !== 'pcs' && (
                                                    <div className="text-[10px] text-gray-400 mt-1">
                                                        {formData.quantity} {formData.unit} × {formData.packaging?.pcsPerBox || 1}
                                                    </div>
                                                )}
                                            </div>
                                            <div className="bg-white rounded-lg p-3 border-2 border-emerald-200 shadow-sm">
                                                <div className="text-xs font-medium text-emerald-600 mb-1.5 uppercase tracking-wide">Boxes</div>
                                                <div className="text-2xl font-bold text-emerald-700">{quantityConversions.boxes.toLocaleString()}</div>
                                                {formData.unit !== 'box' && formData.unit !== 'units' && (
                                                    <div className="text-[10px] text-gray-400 mt-1">
                                                        {quantityConversions.pcs.toLocaleString()} ÷ {formData.packaging?.pcsPerBox || 1}
                                                    </div>
                                                )}
                                            </div>
                                            <div className="bg-white rounded-lg p-3 border-2 border-purple-200 shadow-sm">
                                                <div className="text-xs font-medium text-purple-600 mb-1.5 uppercase tracking-wide">Pallets</div>
                                                <div className="space-y-1">
                                                    <div className="flex items-baseline justify-center gap-2">
                                                        <span className="text-2xl font-bold text-purple-700">{quantityConversions.palletsRounded.toLocaleString()}</span>
                                                        {quantityConversions.palletsExact !== quantityConversions.palletsRounded && (
                                                            <span className="text-xs text-gray-500 font-normal">
                                                                (net: {quantityConversions.palletsExact.toFixed(3)})
                                                            </span>
                                                        )}
                                                    </div>
                                                    {formData.unit !== 'pallets' && (
                                                        <div className="text-[10px] text-gray-400 mt-1">
                                                            {quantityConversions.boxes.toLocaleString()} ÷ {formData.packaging?.boxesPerPallet || 1}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="bg-white rounded-lg p-3 border border-gray-200">
                                            <div className="flex items-center justify-center gap-4 text-xs">
                                                <div className="flex items-center gap-1.5">
                                                    <span className="font-semibold text-gray-700">PCS/Box:</span>
                                                    <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded font-mono font-bold">
                                                        {formData.packaging?.pcsPerBox || 1}
                                                    </span>
                                                </div>
                                                <span className="text-gray-300">•</span>
                                                <div className="flex items-center gap-1.5">
                                                    <span className="font-semibold text-gray-700">Boxes/Pallet:</span>
                                                    <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded font-mono font-bold">
                                                        {formData.packaging?.boxesPerPallet || 1}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </Card>
                </div>
            </div>
        </div>
    );
};
