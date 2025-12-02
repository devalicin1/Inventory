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
        <div className="space-y-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="space-y-6">
                    <Card className="overflow-hidden">
                        <div className="p-5 bg-gradient-to-r from-indigo-50 to-purple-50 border-b border-indigo-100">
                            <h3 className="text-lg font-bold text-gray-900 flex items-center gap-3">
                                <div className="p-2 bg-indigo-500 rounded-xl shadow-lg shadow-indigo-200">
                                    <CogIcon className="h-5 w-5 text-white" />
                                </div>
                                Production Specifications
                            </h3>
                        </div>

                        <div className="p-6 space-y-6">
                            {/* Product Dimensions */}
                            <div className="pb-5 border-b-2 border-gray-100">
                                <h4 className="text-sm font-bold text-gray-900 mb-4 flex items-center gap-2">
                                    <CubeIcon className="h-5 w-5 text-indigo-500" />
                                    Product Dimensions
                                </h4>
                                <div className="grid grid-cols-3 gap-4">
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
                            <div className="pb-5 border-b-2 border-gray-100">
                                <h4 className="text-sm font-bold text-gray-900 mb-4 flex items-center gap-2">
                                    <DocumentTextIcon className="h-5 w-5 text-indigo-500" />
                                    Sheet Dimensions
                                </h4>
                                <div className="mb-4">
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">Select Sheet from Inventory</label>
                                    <div className="relative">
                                        {/* Search and Filter Bar */}
                                        <div className="mb-3 space-y-3">
                                            <div className="relative">
                                                <MagnifyingGlassIcon className="absolute left-4 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                                                <input
                                                    type="text"
                                                    placeholder="Search by SKU or name..."
                                                    value={sheetSearchTerm}
                                                    onChange={(e) => {
                                                        setSheetSearchTerm(e.target.value);
                                                        setShowSheetDropdown(true);
                                                    }}
                                                    onFocus={() => setShowSheetDropdown(true)}
                                                    className="block w-full pl-12 pr-4 py-3 rounded-xl border-2 border-gray-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 bg-white text-base transition-all"
                                                />
                                            </div>
                                            {groups.length > 0 && (
                                                <div className="flex items-center gap-3">
                                                    <FolderIcon className="h-5 w-5 text-gray-400" />
                                                    <select
                                                        value={selectedGroupId}
                                                        onChange={(e) => {
                                                            setSelectedGroupId(e.target.value);
                                                            setShowSheetDropdown(true);
                                                        }}
                                                        className="flex-1 rounded-xl border-2 border-gray-200 py-3 px-4 text-base focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 bg-white transition-all"
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
                                                className="block w-full rounded-xl border-2 border-gray-200 py-3 px-4 text-base focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 bg-white text-left flex items-center justify-between transition-all"
                                            >
                                                <span className={selectedSheet ? 'text-gray-900' : 'text-gray-500'}>
                                                    {selectedSheet 
                                                        ? `${selectedSheet.sku} — ${decodeProductName(selectedSheet.name)}${selectedSheet.groupId ? ` (${getGroupPath(selectedSheet.groupId)})` : ''}`
                                                        : '— Select sheet from inventory —'}
                                                </span>
                                                <ChevronDownIcon className={`h-5 w-5 text-gray-400 transition-transform ${showSheetDropdown ? 'transform rotate-180' : ''}`} />
                                            </button>
                                            
                                            {showSheetDropdown && (
                                                <div className="absolute z-50 w-full mt-2 bg-white border-2 border-gray-200 rounded-xl shadow-xl max-h-96 overflow-auto">
                                                    {filteredSheets.length === 0 ? (
                                                        <div className="px-4 py-6 text-base text-gray-500 text-center">
                                                            No sheets found
                                                        </div>
                                                    ) : (
                                                        <div className="py-2">
                                                            {Array.from(groupedSheets.entries()).map(([groupId, groupSheets]) => (
                                                                <div key={groupId}>
                                                                    {groupId !== '__ungrouped__' && groups.length > 0 && (
                                                                        <div className="px-4 py-2 bg-gray-50 border-b border-gray-200 text-xs font-bold text-gray-700 flex items-center gap-2 uppercase tracking-wider">
                                                                            <FolderIcon className="h-4 w-4" />
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
                                                                            className={`w-full px-4 py-3 text-left hover:bg-indigo-50 transition-colors ${
                                                                                selectedSheetId === p.id ? 'bg-indigo-100' : ''
                                                                            }`}
                                                                        >
                                                                            <div className="flex items-center gap-3">
                                                                                <DocumentTextIcon className="h-5 w-5 text-gray-400 flex-shrink-0" />
                                                                                <div className="flex-1 min-w-0">
                                                                                    <div className="font-medium text-gray-900 truncate">{decodeProductName(p.name)}</div>
                                                                                    <div className="text-sm text-gray-500">SKU: {p.sku}</div>
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
                                        <div className="mt-3 p-4 bg-gradient-to-br from-indigo-50 to-purple-50 rounded-xl border-2 border-indigo-200">
                                            <div className="font-bold text-gray-900">{decodeProductName(selectedSheet.name)}</div>
                                            <div className="text-gray-600 mt-1">
                                                SKU: {selectedSheet.sku}
                                                {selectedSheet.groupId && ` • Group: ${getGroupPath(selectedSheet.groupId)}`}
                                            </div>
                                        </div>
                                    )}
                                </div>
                                <div className="grid grid-cols-2 gap-4">
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
                            <div className="pb-5 border-b-2 border-gray-100">
                                <h4 className="text-sm font-bold text-gray-900 mb-4 flex items-center gap-2">
                                    <WrenchScrewdriverIcon className="h-5 w-5 text-indigo-500" />
                                    Forme Dimensions
                                </h4>
                                <div className="grid grid-cols-2 gap-4">
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
                                <h4 className="text-sm font-bold text-gray-900 mb-4">Production Parameters</h4>
                                <div className="grid grid-cols-2 gap-4">
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
                                <div className="grid grid-cols-2 gap-4 mt-4">
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
                                <div className="grid grid-cols-2 gap-4 mt-4">
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
                                <div className="grid grid-cols-2 gap-4 mt-4">
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
                    <Card className="overflow-hidden">
                        <div className="p-5 bg-gradient-to-r from-cyan-50 to-blue-50 border-b border-cyan-100">
                            <h3 className="text-lg font-bold text-gray-900">Specifications Summary</h3>
                        </div>
                        <div className="p-6">
                            <div className="space-y-3">
                                <div className="flex justify-between items-center p-4 bg-gray-50 rounded-xl">
                                    <span className="text-gray-600 font-medium">Quantity (PCS)</span>
                                    <span className="text-xl font-bold text-gray-900">{quantityInPcs.toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between items-center p-4 bg-gray-50 rounded-xl">
                                    <span className="text-gray-600 font-medium">Theoretical Number Up</span>
                                    <span className="text-xl font-bold text-gray-900">{theoreticalNumberUp ?? 'N/A'}</span>
                                </div>
                                <div className="flex justify-between items-center p-4 bg-gray-50 rounded-xl">
                                    <span className="text-gray-600 font-medium">Sheets Needed</span>
                                    <span className="text-xl font-bold text-gray-900">{sheetsNeeded ?? 'N/A'}</span>
                                </div>
                                <div className="flex justify-between items-center p-4 bg-gray-50 rounded-xl">
                                    <span className="text-gray-600 font-medium">Sheets with Overs</span>
                                    <span className="text-xl font-bold text-gray-900">{sheetsNeededWithOvers ?? 'N/A'}</span>
                                </div>
                                <div className="p-4 bg-gray-50 rounded-xl">
                                    <div className="flex justify-between items-center">
                                        <label className="text-gray-600 font-medium">Sheet Wastage</label>
                                        <input
                                            type="number"
                                            min="0"
                                            value={formData.productionSpecs.sheetWastage || ''}
                                            onChange={(e) => updateParam('sheetWastage', Number(e.target.value))}
                                            className="w-28 rounded-xl border-2 border-gray-200 py-2 px-4 text-right font-bold focus:border-cyan-500 focus:ring-2 focus:ring-cyan-100 transition-all"
                                            placeholder="0"
                                        />
                                    </div>
                                </div>
                                <div className="flex justify-between items-center p-4 bg-gradient-to-r from-cyan-100 to-blue-100 rounded-xl border-2 border-cyan-200">
                                    <span className="text-gray-900 font-bold">Sheets with Wastage</span>
                                    <span className="text-2xl font-bold text-cyan-700">{sheetsNeededWithWastage ?? 'N/A'}</span>
                                </div>
                            </div>

                            {theoreticalNumberUp !== undefined && formData.productionSpecs.numberUp && theoreticalNumberUp !== formData.productionSpecs.numberUp && (
                                <div className="mt-4 rounded-xl border-2 border-amber-300 bg-amber-50 text-amber-800 p-4 font-medium">
                                    ⚠️ Layout mismatch: theoretical {theoreticalNumberUp} ≠ entered {formData.productionSpecs.numberUp}
                                </div>
                            )}
                        </div>
                    </Card>

                    <Card className="overflow-hidden">
                        <div className="p-5 bg-gradient-to-r from-slate-50 to-gray-50 border-b border-slate-100">
                            <h3 className="text-lg font-bold text-gray-900">Additional Specifications</h3>
                        </div>
                        <div className="p-6 space-y-5">
                            <div className="pb-5 border-b-2 border-gray-100">
                                <h4 className="text-sm font-bold text-gray-900 mb-4 flex items-center gap-2">
                                    <WrenchScrewdriverIcon className="h-5 w-5 text-slate-500" />
                                    CutTo Dimensions
                                </h4>
                                <div className="grid grid-cols-2 gap-4">
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
