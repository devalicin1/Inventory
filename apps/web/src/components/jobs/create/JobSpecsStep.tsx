import React, { useMemo, useState, useRef, useEffect } from 'react';
import { CogIcon, CubeIcon, DocumentTextIcon, WrenchScrewdriverIcon, MagnifyingGlassIcon, FolderIcon, ChevronDownIcon } from '@heroicons/react/24/outline';
import type { JobFormData } from './types';
import { Card } from '../../ui/Card';
import { Input } from '../../ui/Input';
import { useJobCalculations } from './useJobCalculations';
import type { Group } from '../../../api/products';

interface JobSpecsStepProps {
    formData: JobFormData;
    setFormData: React.Dispatch<React.SetStateAction<JobFormData>>;
    sheetProducts: any[];
    groups?: Group[];
}

export const JobSpecsStep: React.FC<JobSpecsStepProps> = ({
    formData,
    setFormData,
    sheetProducts,
    groups = [],
}) => {
    const [sheetSearchTerm, setSheetSearchTerm] = useState('');
    const [selectedGroupId, setSelectedGroupId] = useState<string>('');
    const [showSheetDropdown, setShowSheetDropdown] = useState(false);
    const [selectedSheetId, setSelectedSheetId] = useState<string>('');
    const dropdownRef = useRef<HTMLDivElement>(null);
    
    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setShowSheetDropdown(false);
            }
        };
        
        if (showSheetDropdown) {
            document.addEventListener('mousedown', handleClickOutside);
            return () => {
                document.removeEventListener('mousedown', handleClickOutside);
            };
        }
    }, [showSheetDropdown]);
    
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
        let cleaned = name
            .replace(/\uFFFD/g, '')
            .replace(/\u0000/g, '')
            .trim();
        try {
            const textarea = document.createElement('textarea');
            textarea.innerHTML = cleaned;
            cleaned = textarea.value || cleaned;
        } catch (e) {
            // If decoding fails, use original
        }
        return cleaned || name;
    };
    
    // Use calculations from useJobCalculations hook
    const { theoreticalNumberUp, sheetsNeeded, sheetsNeededWithOvers, sheetsNeededWithWastage } = useJobCalculations(formData);
    
    // Update BOM sheet quantity when sheetsNeeded changes
    useEffect(() => {
        if (selectedSheetId && (sheetsNeededWithWastage || sheetsNeeded)) {
            const calculatedQty = sheetsNeededWithWastage || sheetsNeeded || 0;
            const selectedSheet = sheetProducts.find(p => p.id === selectedSheetId);
            
            if (selectedSheet && calculatedQty > 0) {
                setFormData(prev => {
                    const existingSheetIndex = prev.bom.findIndex(
                        (item: any) => {
                            const itemSku = (item.sku || '').toLowerCase();
                            const itemName = (item.name || '').toLowerCase();
                            const productSku = (selectedSheet.sku || '').toLowerCase();
                            const productName = decodeProductName(selectedSheet.name || '').toLowerCase();
                            return itemSku === productSku || itemName === productName;
                        }
                    );
                    
                    if (existingSheetIndex !== -1) {
                        return {
                            ...prev,
                            bom: prev.bom.map((item: any, idx: number) => 
                                idx === existingSheetIndex 
                                    ? { ...item, qty: calculatedQty, qtyRequired: calculatedQty }
                                    : item
                            )
                        };
                    }
                    return prev;
                });
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [sheetsNeededWithWastage, sheetsNeeded, selectedSheetId]);

    const filteredSheets = useMemo(() => {
        return sheetProducts.filter(p => {
            const decodedName = decodeProductName(p.name);
            const matchesSearch = !sheetSearchTerm || 
                decodedName.toLowerCase().includes(sheetSearchTerm.toLowerCase()) ||
                p.sku?.toLowerCase().includes(sheetSearchTerm.toLowerCase());
            const matchesGroup = !selectedGroupId || (p as any).groupId === selectedGroupId;
            return matchesSearch && matchesGroup;
        });
    }, [sheetProducts, sheetSearchTerm, selectedGroupId]);
    
    // Group sheets by group and sort alphabetically
    const groupedSheets = useMemo(() => {
        const grouped = new Map<string, typeof sheetProducts>();
        // Sort filtered sheets alphabetically by name
        const sortedSheets = [...filteredSheets].sort((a, b) => {
            const nameA = decodeProductName(a.name || '').toLowerCase();
            const nameB = decodeProductName(b.name || '').toLowerCase();
            return nameA.localeCompare(nameB);
        });
        
        sortedSheets.forEach(p => {
            const groupId = (p as any).groupId || '__ungrouped__';
            if (!grouped.has(groupId)) {
                grouped.set(groupId, []);
            }
            grouped.get(groupId)!.push(p);
        });
        return grouped;
    }, [filteredSheets]);
    
    const selectedSheet = sheetProducts.find(p => p.id === selectedSheetId);
    
    // Calculate quantity in pcs (pieces) for display
    const quantityInPcs = useMemo(() => {
        let totalQty = formData.quantity || 0;
        if (formData.unit === 'box' || formData.unit === 'units') {
            const pcsPerBox = formData.packaging?.pcsPerBox || 1;
            totalQty = totalQty * pcsPerBox;
        } else if (formData.unit === 'pallets') {
            const pcsPerOuter = formData.packaging?.pcsPerBox || 1;
            const outersPerPallet = formData.packaging?.boxesPerPallet || 1;
            totalQty = totalQty * outersPerPallet * pcsPerOuter;
        }
        return totalQty;
    }, [formData.quantity, formData.unit, formData.packaging?.pcsPerBox, formData.packaging?.boxesPerPallet]);


    const updateSpec = (section: 'size' | 'sheet' | 'forme' | 'cutTo', field: string, value: number) => {
        setFormData(prev => ({
            ...prev,
            productionSpecs: {
                ...prev.productionSpecs,
                [section]: {
                    ...prev.productionSpecs[section],
                    [field]: value
                }
            }
        }));
    };

    const updateParam = (field: string, value: any) => {
        setFormData(prev => ({
            ...prev,
            productionSpecs: {
                ...prev.productionSpecs,
                [field]: value
            }
        }));
    };
    
    // Helper function to extract dimensions from product name or specs
    const extractDimensions = (product: any): { width?: number; length?: number } => {
        const name = product.name || '';
        const specs = product.dimensionsWxLmm || product.dimensions || '';
        
        // Try to extract from dimensions field (format: "615x905" or "615 x 905")
        if (specs) {
            const match = specs.match(/(\d+)\s*[x×]\s*(\d+)/i);
            if (match) {
                return { width: Number(match[1]), length: Number(match[2]) };
            }
        }
        
        // Try to extract from product name (format: "450 x 835" or "450x835")
        const nameMatch = name.match(/(\d+)\s*[x×]\s*(\d+)/i);
        if (nameMatch) {
            return { width: Number(nameMatch[1]), length: Number(nameMatch[2]) };
        }
        
        return {};
    };

    return (
        <div className="max-w-6xl mx-auto space-y-6">
            <div className="mb-8">
                <h2 className="text-2xl font-bold text-gray-900">Product Specifications</h2>
                <p className="text-gray-600 mt-2">Enter technical parameters and production details</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="space-y-6">
                    <Card>
                        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                            <CogIcon className="h-5 w-5 text-primary-600" />
                            Production Specifications
                        </h3>

                        <div className="space-y-6">
                            {/* Product Dimensions */}
                            <div className="border-b border-gray-200 pb-4">
                                <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                                    <CubeIcon className="h-4 w-4 text-primary-500" />
                                    Product Dimensions
                                </h4>
                                <div className="grid grid-cols-3 gap-3">
                                    <Input
                                        type="number"
                                        label="Width (mm) *"
                                        value={formData.productionSpecs.size.width}
                                        onChange={(e) => updateSpec('size', 'width', Number(e.target.value))}
                                    />
                                    <Input
                                        type="number"
                                        label="Length (mm) *"
                                        value={formData.productionSpecs.size.length}
                                        onChange={(e) => updateSpec('size', 'length', Number(e.target.value))}
                                    />
                                    <Input
                                        type="number"
                                        label="Height (mm)"
                                        value={formData.productionSpecs.size.height}
                                        onChange={(e) => updateSpec('size', 'height', Number(e.target.value))}
                                    />
                                </div>
                            </div>

                            {/* Sheet Dimensions */}
                            <div className="border-b border-gray-200 pb-4">
                                <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                                    <DocumentTextIcon className="h-4 w-4 text-primary-500" />
                                    Sheet Dimensions
                                </h4>
                                <div className="mb-3">
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Select Sheet from Inventory</label>
                                    <div className="relative">
                                        {/* Search and Filter Bar */}
                                        <div className="mb-2 space-y-2">
                                            <div className="relative">
                                                <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                                                <input
                                                    type="text"
                                                    placeholder="Search by SKU or name..."
                                                    value={sheetSearchTerm}
                                                    onChange={(e) => {
                                                        setSheetSearchTerm(e.target.value);
                                                        setShowSheetDropdown(true);
                                                    }}
                                                    onFocus={() => setShowSheetDropdown(true)}
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
                                                            setShowSheetDropdown(true);
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
                                        
                                        {/* Sheet Selection Dropdown */}
                                        <div className="relative" ref={dropdownRef}>
                                            <button
                                                type="button"
                                                onClick={() => setShowSheetDropdown(!showSheetDropdown)}
                                                className="block w-full rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 py-2.5 px-3 border bg-white text-left flex items-center justify-between"
                                            >
                                                <span className={selectedSheet ? 'text-gray-900' : 'text-gray-500'}>
                                                    {selectedSheet 
                                                        ? `${selectedSheet.sku} — ${decodeProductName(selectedSheet.name)}${selectedSheet.groupId ? ` (${getGroupPath(selectedSheet.groupId)})` : ''}`
                                                        : '— Select sheet from inventory —'}
                                                </span>
                                                <ChevronDownIcon className={`h-5 w-5 text-gray-400 transition-transform ${showSheetDropdown ? 'transform rotate-180' : ''}`} />
                                            </button>
                                            
                                            {showSheetDropdown && (
                                                <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-96 overflow-auto">
                                                    {filteredSheets.length === 0 ? (
                                                        <div className="px-4 py-3 text-sm text-gray-500 text-center">
                                                            No sheets found
                                                        </div>
                                                    ) : (
                                                        <div className="py-1">
                                                            {Array.from(groupedSheets.entries()).map(([groupId, groupSheets]) => (
                                                                <div key={groupId}>
                                                                    {groupId !== '__ungrouped__' && groups.length > 0 && (
                                                                        <div className="px-3 py-2 bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-700 flex items-center gap-1">
                                                                            <FolderIcon className="h-3 w-3" />
                                                                            {getGroupPath(groupId)}
                                                                        </div>
                                                                    )}
                                                                    {groupSheets.map(p => (
                                                                        <button
                                                                            key={p.id}
                                                                            type="button"
                                                                            onClick={() => {
                                                                                setSelectedSheetId(p.id);
                                                                                setShowSheetDropdown(false);
                                                                                setSheetSearchTerm('');
                                                                                setSelectedGroupId('');
                                                                                
                                                                                // Extract dimensions from product name or specs if available
                                                                                const dimensions = extractDimensions(p);
                                                                                if (dimensions.width && dimensions.length) {
                                                                                    updateSpec('sheet', 'width', dimensions.width);
                                                                                    updateSpec('sheet', 'length', dimensions.length);
                                                                                }
                                                                                
                                                                                // Extract microns and GSM from product
                                                                                // Microns comes from 'cal' field, GSM from 'gsm' field
                                                                                if (p.cal !== undefined && p.cal !== null && p.cal !== '') {
                                                                                    const calValue = typeof p.cal === 'string' ? Number(p.cal) : p.cal;
                                                                                    if (!isNaN(calValue) && calValue > 0) {
                                                                                        updateParam('microns', calValue);
                                                                                    }
                                                                                } else if (p.microns !== undefined && p.microns !== null) {
                                                                                    updateParam('microns', Number(p.microns));
                                                                                }
                                                                                if (p.gsm) {
                                                                                    updateParam('gsm', String(p.gsm));
                                                                                }
                                                                                
                                                                                // Add sheet to BOM automatically with calculated quantity
                                                                                // Use sheetsNeededWithWastage if available, otherwise use sheetsNeeded
                                                                                const calculatedQty = sheetsNeededWithWastage || sheetsNeeded || 0;
                                                                                
                                                                                const sheetBomItem = {
                                                                                    sku: p.sku || '',
                                                                                    name: decodeProductName(p.name) || '',
                                                                                    qty: calculatedQty,
                                                                                    qtyRequired: calculatedQty,
                                                                                    uom: 'sheets', // or 'sht' based on your system
                                                                                    reserved: 0,
                                                                                    consumed: 0
                                                                                };
                                                                                
                                                                                // Check if sheet already exists in BOM
                                                                                const existingSheetIndex = formData.bom.findIndex(
                                                                                    (item: any) => {
                                                                                        const itemSku = (item.sku || '').toLowerCase();
                                                                                        const itemName = (item.name || '').toLowerCase();
                                                                                        const productSku = (p.sku || '').toLowerCase();
                                                                                        const productName = decodeProductName(p.name || '').toLowerCase();
                                                                                        return itemSku === productSku || itemName === productName;
                                                                                    }
                                                                                );
                                                                                
                                                                                if (existingSheetIndex === -1) {
                                                                                    // Add new sheet to BOM
                                                                                    setFormData(prev => ({
                                                                                        ...prev,
                                                                                        bom: [...prev.bom, sheetBomItem]
                                                                                    }));
                                                                                } else {
                                                                                    // Update existing sheet in BOM
                                                                                    setFormData(prev => ({
                                                                                        ...prev,
                                                                                        bom: prev.bom.map((item: any, idx: number) => 
                                                                                            idx === existingSheetIndex 
                                                                                                ? { 
                                                                                                    ...item, 
                                                                                                    sku: p.sku || item.sku, 
                                                                                                    name: decodeProductName(p.name) || item.name,
                                                                                                    qty: calculatedQty || item.qty
                                                                                                }
                                                                                                : item
                                                                                        )
                                                                                    }));
                                                                                }
                                                                            }}
                                                                            className={`w-full px-4 py-2 text-left text-sm hover:bg-primary-50 transition-colors ${
                                                                                selectedSheetId === p.id ? 'bg-primary-100' : ''
                                                                            }`}
                                                                        >
                                                                            <div className="flex items-center gap-2">
                                                                                <DocumentTextIcon className="h-4 w-4 text-gray-400 flex-shrink-0" />
                                                                                <div className="flex-1 min-w-0">
                                                                                    <div className="font-medium text-gray-900 truncate">{decodeProductName(p.name)}</div>
                                                                                    <div className="text-xs text-gray-500">SKU: {p.sku}</div>
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
                                    
                                    {/* Selected Sheet Info */}
                                    {selectedSheet && (
                                        <div className="mt-2 p-3 bg-primary-50 rounded-lg border border-primary-200 text-sm">
                                            <div className="font-medium text-primary-900">{decodeProductName(selectedSheet.name)}</div>
                                            <div className="text-primary-700 mt-1">
                                                SKU: {selectedSheet.sku}
                                                {selectedSheet.groupId && ` • Group: ${getGroupPath(selectedSheet.groupId)}`}
                                            </div>
                                        </div>
                                    )}
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <Input
                                        type="number"
                                        label="Sheet Width (mm)"
                                        value={formData.productionSpecs.sheet.width}
                                        onChange={(e) => updateSpec('sheet', 'width', Number(e.target.value))}
                                    />
                                    <Input
                                        type="number"
                                        label="Sheet Length (mm)"
                                        value={formData.productionSpecs.sheet.length}
                                        onChange={(e) => updateSpec('sheet', 'length', Number(e.target.value))}
                                    />
                                </div>
                            </div>

                            {/* Forme Dimensions */}
                            <div className="border-b border-gray-200 pb-4">
                                <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                                    <WrenchScrewdriverIcon className="h-4 w-4 text-primary-500" />
                                    Forme Dimensions
                                </h4>
                                <div className="grid grid-cols-2 gap-3">
                                    <Input
                                        type="number"
                                        label="Forme Width (mm)"
                                        value={formData.productionSpecs.forme.width}
                                        onChange={(e) => updateSpec('forme', 'width', Number(e.target.value))}
                                    />
                                    <Input
                                        type="number"
                                        label="Forme Length (mm)"
                                        value={formData.productionSpecs.forme.length}
                                        onChange={(e) => updateSpec('forme', 'length', Number(e.target.value))}
                                    />
                                </div>
                            </div>

                            {/* Parameters */}
                            <div>
                                <h4 className="text-sm font-semibold text-gray-900 mb-3">Production Parameters</h4>
                                <div className="grid grid-cols-2 gap-3">
                                    <Input
                                        type="number"
                                        label="Number Up *"
                                        value={formData.productionSpecs.numberUp}
                                        onChange={(e) => updateParam('numberUp', Number(e.target.value))}
                                    />
                                    <Input
                                        type="number"
                                        label="Colors *"
                                        value={formData.productionSpecs.printedColors}
                                        onChange={(e) => updateParam('printedColors', Number(e.target.value))}
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-3 mt-3">
                                    <Input
                                        label="Varnish"
                                        value={formData.productionSpecs.varnish}
                                        onChange={(e) => updateParam('varnish', e.target.value)}
                                    />
                                    <Input
                                        label="Board Type"
                                        value={formData.productionSpecs.board}
                                        onChange={(e) => updateParam('board', e.target.value)}
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-3 mt-3">
                                    <Input
                                        type="number"
                                        label="Overs Percentage"
                                        value={formData.productionSpecs.oversPct}
                                        onChange={(e) => updateParam('oversPct', Number(e.target.value))}
                                    />
                                    <Input
                                        type="number"
                                        label="Microns"
                                        value={formData.productionSpecs.microns}
                                        onChange={(e) => updateParam('microns', Number(e.target.value))}
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-3 mt-3">
                                    <Input
                                        label="GSM"
                                        value={formData.productionSpecs.gsm}
                                        onChange={(e) => updateParam('gsm', e.target.value)}
                                    />
                                    <Input
                                        label="Tags"
                                        placeholder="tag1, tag2"
                                        value={formData.productionSpecs.tags?.join(', ')}
                                        onChange={(e) => updateParam('tags', e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
                                    />
                                </div>
                            </div>
                        </div>
                    </Card>
                </div>

                <div className="space-y-6">
                    <Card>
                        <h3 className="text-lg font-semibold text-gray-900 mb-4">Specifications Summary</h3>
                        <div className="space-y-3 text-sm">
                            <div className="flex justify-between py-2 border-b border-gray-100">
                                <span className="text-gray-600">Quantity (PCS)</span>
                                <span className="font-medium">{quantityInPcs.toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between py-2 border-b border-gray-100">
                                <span className="text-gray-600">Theoretical Number Up</span>
                                <span className="font-medium">{theoreticalNumberUp ?? 'N/A'}</span>
                            </div>
                            <div className="flex justify-between py-2 border-b border-gray-100">
                                <span className="text-gray-600">Sheets Needed</span>
                                <span className="font-medium">{sheetsNeeded ?? 'N/A'}</span>
                            </div>
                            <div className="flex justify-between py-2 border-b border-gray-100">
                                <span className="text-gray-600">Sheets with Overs</span>
                                <span className="font-medium">{sheetsNeededWithOvers ?? 'N/A'}</span>
                            </div>
                            <div className="pt-2">
                                <div className="flex justify-between items-center mb-3">
                                    <label className="text-gray-600 font-medium">Sheet Wastage</label>
                                    <input
                                        type="number"
                                        min="0"
                                        value={formData.productionSpecs.sheetWastage || ''}
                                        onChange={(e) => updateParam('sheetWastage', Number(e.target.value))}
                                        className="w-24 rounded-lg border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 py-1.5 px-3 border text-right"
                                        placeholder="0"
                                    />
                                </div>
                            </div>
                            <div className="flex justify-between py-2 border-t border-gray-200 pt-2">
                                <span className="text-gray-900 font-semibold">Sheets with Wastage</span>
                                <span className="font-bold text-primary-600">{sheetsNeededWithWastage ?? 'N/A'}</span>
                            </div>
                        </div>

                        {theoreticalNumberUp !== undefined && formData.productionSpecs.numberUp && theoreticalNumberUp !== formData.productionSpecs.numberUp && (
                            <div className="mt-4 rounded-lg border border-amber-300 bg-amber-50 text-amber-800 p-3 text-sm">
                                Layout mismatch: theoretical {theoreticalNumberUp} ≠ entered {formData.productionSpecs.numberUp}
                            </div>
                        )}
                    </Card>

                    <Card>
                        <h3 className="text-lg font-semibold text-gray-900 mb-4">Additional Specifications</h3>
                        <div className="space-y-4">
                            <div className="border-b border-gray-200 pb-4">
                                <h4 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                                    <WrenchScrewdriverIcon className="h-4 w-4 text-primary-500" />
                                    CutTo Dimensions
                                </h4>
                                <div className="grid grid-cols-2 gap-3">
                                    <Input
                                        type="number"
                                        label="CutTo Width (mm)"
                                        value={formData.productionSpecs.cutTo.width}
                                        onChange={(e) => updateSpec('cutTo', 'width', Number(e.target.value))}
                                    />
                                    <Input
                                        type="number"
                                        label="CutTo Length (mm)"
                                        value={formData.productionSpecs.cutTo.length}
                                        onChange={(e) => updateSpec('cutTo', 'length', Number(e.target.value))}
                                    />
                                </div>
                            </div>
                            <Input
                                label="Style"
                                value={formData.productionSpecs.style}
                                onChange={(e) => updateParam('style', e.target.value)}
                            />
                        </div>
                    </Card>
                </div>
            </div>
        </div>
    );
};
