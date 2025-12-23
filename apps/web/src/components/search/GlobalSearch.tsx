import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useUIStore } from '../../state/uiStore';
import { useSessionStore } from '../../state/sessionStore';
import { listJobs, type Job } from '../../api/production-jobs';
import { listProducts, listGroups, type Product, type Group } from '../../api/products';
import { listPurchaseOrders, type PurchaseOrder } from '../../api/purchase-orders';
import { scoreAndSort, highlightMatch, type ScoredResult, type HighlightSegment } from '../../utils/search';
import {
    MagnifyingGlassIcon,
    XMarkIcon,
    CubeIcon,
    ClipboardDocumentListIcon,
    ShoppingCartIcon,
    ArrowRightIcon,
    ArrowPathIcon,
    ClockIcon
} from '@heroicons/react/24/outline';

// Recent searches storage
const RECENT_SEARCHES_KEY = 'globalSearch_recentSearches';
const MAX_RECENT_SEARCHES = 10;

function getRecentSearches(workspaceId: string): string[] {
  try {
    const key = `${RECENT_SEARCHES_KEY}_${workspaceId}`;
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function addRecentSearch(workspaceId: string, query: string) {
  if (!query.trim()) return;
  try {
    const key = `${RECENT_SEARCHES_KEY}_${workspaceId}`;
    const recent = getRecentSearches(workspaceId);
    const updated = [query, ...recent.filter(q => q !== query)].slice(0, MAX_RECENT_SEARCHES);
    localStorage.setItem(key, JSON.stringify(updated));
  } catch {
    // Ignore storage errors
  }
}

interface SearchResultItem {
  id: string;
  type: 'job' | 'product' | 'po';
  title: string;
  subtitle: string;
  icon: React.ComponentType<{ className?: string }>;
  iconBg: string;
  iconColor: string;
  path: string;
  score: number;
  data: Job | Product | PurchaseOrder;
}

export const GlobalSearch: React.FC = () => {
    const { isSearchOpen, closeSearch } = useUIStore();
    const { workspaceId } = useSessionStore();
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const [query, setQuery] = useState('');
    const [activeIndex, setActiveIndex] = useState(-1);
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);
    const resultRefs = useRef<(HTMLButtonElement | null)[]>([]);
    const [recentSearches, setRecentSearches] = useState<string[]>([]);
    const [selectedType, setSelectedType] = useState<'job' | 'product' | 'po' | null>(null);

    // React Query hooks for cached data
    const { data: jobsData, refetch: refetchJobs } = useQuery({
        queryKey: ['globalSearchJobs', workspaceId],
        queryFn: () => listJobs(workspaceId!, {}, { limit: 200 }),
        enabled: !!workspaceId && isSearchOpen,
        staleTime: 30000, // 30 seconds
    });

    const { data: products, refetch: refetchProducts } = useQuery({
        queryKey: ['globalSearchProducts', workspaceId],
        queryFn: () => listProducts(workspaceId!),
        enabled: !!workspaceId && isSearchOpen,
        staleTime: 30000,
    });

    const { data: posData, refetch: refetchPOs } = useQuery({
        queryKey: ['globalSearchPOs', workspaceId],
        queryFn: () => listPurchaseOrders(workspaceId!, {}, { limit: 200 }),
        enabled: !!workspaceId && isSearchOpen,
        staleTime: 30000,
    });

    const { data: groups = [] } = useQuery<Group[]>({
        queryKey: ['groups', workspaceId],
        queryFn: () => listGroups(workspaceId!),
        enabled: !!workspaceId && isSearchOpen,
    });

    // Refetch when overlay opens
    useEffect(() => {
        if (isSearchOpen && workspaceId) {
            const refresh = async () => {
                setIsRefreshing(true);
                try {
                    await Promise.all([refetchJobs(), refetchProducts(), refetchPOs()]);
                    setLastUpdated(new Date());
                } catch (error) {
                    console.error('Failed to refresh search index:', error);
                } finally {
                    setIsRefreshing(false);
                }
            };
            refresh();
            setRecentSearches(getRecentSearches(workspaceId));
        }
    }, [isSearchOpen, workspaceId, refetchJobs, refetchProducts, refetchPOs]);

    // Listen for real-time updates
    useEffect(() => {
        if (!workspaceId) return;

        const handleUpdate = () => {
            refetchJobs();
            refetchProducts();
            refetchPOs();
            setLastUpdated(new Date());
        };

        window.addEventListener('stockTransactionCreated', handleUpdate as EventListener);
        // Listen for product/job/PO updates (if events exist)
        window.addEventListener('productUpdated', handleUpdate as EventListener);
        window.addEventListener('jobUpdated', handleUpdate as EventListener);
        window.addEventListener('poUpdated', handleUpdate as EventListener);

        return () => {
            window.removeEventListener('stockTransactionCreated', handleUpdate as EventListener);
            window.removeEventListener('productUpdated', handleUpdate as EventListener);
            window.removeEventListener('jobUpdated', handleUpdate as EventListener);
            window.removeEventListener('poUpdated', handleUpdate as EventListener);
        };
    }, [workspaceId, refetchJobs, refetchProducts, refetchPOs]);

    // Focus input when opened
    useEffect(() => {
        if (isSearchOpen && inputRef.current) {
            setTimeout(() => {
                inputRef.current?.focus();
            }, 100);
        } else {
            setQuery('');
            setActiveIndex(-1);
            setSelectedType(null);
        }
    }, [isSearchOpen]);

    // Search and score results
    const searchResults = useMemo(() => {
        if (!query.trim() || !workspaceId) return [];

        const allResults: SearchResultItem[] = [];

        // Score and add jobs
        if (jobsData?.jobs) {
            const scoredJobs = scoreAndSort(
                jobsData.jobs,
                query,
                (job) => [
                    job.code || '',
                    job.productName || '',
                    job.customer?.name || ''
                ]
            );

            scoredJobs.forEach(({ item: job, score }) => {
                allResults.push({
                    id: job.id,
                    type: 'job',
                    title: job.code || '',
                    subtitle: job.productName || '',
                    icon: ClipboardDocumentListIcon,
                    iconBg: 'bg-indigo-100',
                    iconColor: 'text-indigo-600',
                    path: `/production?jobId=${job.id}`,
                    score,
                    data: job,
                });
            });
        }

        // Score and add products
        if (products) {
            const scoredProducts = scoreAndSort(
                products,
                query,
                (product) => [
                    product.name || '',
                    product.sku || '',
                    product.id || ''
                ]
            );

            scoredProducts.forEach(({ item: product, score }) => {
                allResults.push({
                    id: product.id,
                    type: 'product',
                    title: product.name || '',
                    subtitle: product.sku || '',
                    icon: CubeIcon,
                    iconBg: 'bg-emerald-100',
                    iconColor: 'text-emerald-600',
                    path: `/inventory/${product.id}`,
                    score,
                    data: product,
                });
            });
        }

        // Score and add POs
        if (posData?.purchaseOrders) {
            const scoredPOs = scoreAndSort(
                posData.purchaseOrders,
                query,
                (po) => [
                    po.poNumber || '',
                    po.vendor?.name || ''
                ]
            );

            scoredPOs.forEach(({ item: po, score }) => {
                allResults.push({
                    id: po.id,
                    type: 'po',
                    title: po.poNumber || '',
                    subtitle: po.vendor?.name || 'Unknown Vendor',
                    icon: ShoppingCartIcon,
                    iconBg: 'bg-amber-100',
                    iconColor: 'text-amber-600',
                    path: `/purchase-orders/${po.id}`,
                    score,
                    data: po,
                });
            });
        }

        // Filter by selected type if any
        let filteredResults = allResults;
        if (selectedType) {
            filteredResults = allResults.filter(result => result.type === selectedType);
        }

        // Sort by score descending, limit to top 50
        return filteredResults.sort((a, b) => b.score - a.score).slice(0, 50);
    }, [query, jobsData, products, posData, workspaceId, selectedType]);

    // Group results by type for display
    const groupedResults = useMemo(() => {
        const grouped: Record<string, SearchResultItem[]> = {
            jobs: [],
            products: [],
            pos: [],
        };

        searchResults.forEach(result => {
            if (result.type === 'job') grouped.jobs.push(result);
            else if (result.type === 'product') grouped.products.push(result);
            else if (result.type === 'po') grouped.pos.push(result);
        });

        return grouped;
    }, [searchResults]);

    // Auto-suggest: recent searches + top matches
    const autoSuggestions = useMemo(() => {
        if (!query.trim()) {
            return recentSearches.slice(0, 5);
        }

        const matchingRecent = recentSearches.filter(term =>
            term.toLowerCase().includes(query.toLowerCase())
        );

        const topMatches = searchResults.slice(0, 5).map(r => r.title);

        return [...new Set([...matchingRecent, ...topMatches])].slice(0, 8);
    }, [query, recentSearches, searchResults]);

    // Keyboard navigation
    useEffect(() => {
        if (!isSearchOpen) return;

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                closeSearch();
                return;
            }

            if (e.key === 'ArrowDown') {
                e.preventDefault();
                setActiveIndex(prev => {
                    const next = prev < searchResults.length - 1 ? prev + 1 : 0;
                    // Scroll into view
                    setTimeout(() => {
                        resultRefs.current[next]?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
                    }, 0);
                    return next;
                });
                return;
            }

            if (e.key === 'ArrowUp') {
                e.preventDefault();
                setActiveIndex(prev => {
                    const next = prev > 0 ? prev - 1 : searchResults.length - 1;
                    setTimeout(() => {
                        resultRefs.current[next]?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
                    }, 0);
                    return next;
                });
                return;
            }

            if (e.key === 'Enter' && activeIndex >= 0 && searchResults[activeIndex]) {
                e.preventDefault();
                const result = searchResults[activeIndex];
                handleNavigate(result.path, result.title);
                return;
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isSearchOpen, searchResults, activeIndex, closeSearch]);

    // Reset active index when query changes
    useEffect(() => {
        setActiveIndex(-1);
    }, [query]);

    const handleNavigate = (path: string, title?: string) => {
        if (query.trim() && workspaceId) {
            addRecentSearch(workspaceId, query);
        }
        navigate(path);
        closeSearch();
        setQuery('');
        setActiveIndex(-1);
    };

    const handleRefresh = async () => {
        setIsRefreshing(true);
        try {
            await Promise.all([refetchJobs(), refetchProducts(), refetchPOs()]);
            setLastUpdated(new Date());
        } catch (error) {
            console.error('Failed to refresh search index:', error);
        } finally {
            setIsRefreshing(false);
        }
    };

    const handleSuggestionClick = (suggestion: string) => {
        setQuery(suggestion);
        inputRef.current?.focus();
    };

    const formatLastUpdated = (date: Date | null) => {
        if (!date) return 'Never';
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffSec = Math.floor(diffMs / 1000);
        const diffMin = Math.floor(diffSec / 60);

        if (diffSec < 10) return 'Just now';
        if (diffSec < 60) return `${diffSec}s ago`;
        if (diffMin < 60) return `${diffMin}m ago`;
        return date.toLocaleTimeString();
    };

    const cleanText = (text: string | null | undefined) => {
        if (!text) return '';
        return text.replace(/\uFFFD/g, "'");
    };

    const formatDate = (date: any) => {
        if (!date) return '';
        if (date?.toDate) return date.toDate().toLocaleDateString();
        return new Date(date).toLocaleDateString();
    };

    const renderHighlighted = (text: string, query: string) => {
        const segments = highlightMatch(text, query);
        return (
            <>
                {segments.map((segment, idx) => 
                    segment.isMatch ? (
                        <mark key={idx} className="bg-yellow-200 text-yellow-900 px-0.5 rounded">
                            {segment.text}
                        </mark>
                    ) : (
                        <span key={idx}>{segment.text}</span>
                    )
                )}
            </>
        );
    };

    if (!isSearchOpen) return null;

    const hasResults = searchResults.length > 0;
    const showSuggestions = query.trim() === '' || (autoSuggestions.length > 0 && !hasResults);

    return (
        <div className="fixed inset-0 z-50 overflow-y-auto" role="dialog" aria-modal="true">
            <div
                className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm transition-opacity"
                onClick={closeSearch}
            />

            <div className="flex min-h-full items-stretch justify-center p-0 text-center sm:p-0">
                <div
                    className="relative flex flex-col w-full h-full max-h-screen transform overflow-hidden rounded-none bg-white/80 backdrop-blur-md text-left shadow-2xl transition-all sm:my-8 sm:h-auto sm:max-h-[80vh] sm:w-full sm:max-w-2xl sm:rounded-2xl border border-white/20 ring-1 ring-black/5"
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Search Input Header */}
                    <div className="relative border-b border-gray-200/50 bg-white/50">
                        <MagnifyingGlassIcon
                            className="pointer-events-none absolute top-3.5 left-4 h-5 w-5 text-gray-400"
                            aria-hidden="true"
                        />
                        <input
                            ref={inputRef}
                            type="text"
                            className="h-12 w-full border-0 bg-transparent pl-11 pr-12 text-gray-900 placeholder:text-gray-400 focus:ring-0 sm:pr-24 sm:text-sm"
                            placeholder="Find anything... (Jobs, Products, POs)"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                        />
                        <div className="absolute top-3 right-3 flex items-center gap-2">
                            {/* Last updated & refresh: only show on md+ to avoid crowding mobile header */}
                            {(lastUpdated || isRefreshing) && (
                                <div className="hidden sm:flex items-center gap-2 mr-1 text-xs text-gray-400">
                                    {lastUpdated && (
                                        <div className="flex items-center gap-1">
                                            <ClockIcon className="h-3 w-3" />
                                            <span>{formatLastUpdated(lastUpdated)}</span>
                                        </div>
                                    )}
                                    <button
                                        onClick={handleRefresh}
                                        disabled={isRefreshing}
                                        className="p-1 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100/50 disabled:opacity-50"
                                        title="Refresh index"
                                    >
                                        <ArrowPathIcon className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                                    </button>
                                </div>
                            )}
                            <button
                                onClick={closeSearch}
                                className="p-1 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100/50"
                            >
                                <XMarkIcon className="h-5 w-5" />
                            </button>
                        </div>
                    </div>

                    {/* Type Filter Buttons */}
                    <div className="px-4 py-2 bg-gray-50/50 border-b border-gray-200/50 flex items-center gap-2 overflow-x-auto">
                        <span className="text-xs text-gray-500 font-medium mr-1">Filter:</span>
                        <button
                            onClick={() => setSelectedType(null)}
                            className={`px-3 py-1 text-xs font-medium rounded-full transition-all whitespace-nowrap ${
                                selectedType === null
                                    ? 'bg-blue-500 text-white shadow-sm'
                                    : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
                            }`}
                        >
                            All
                        </button>
                        <button
                            onClick={() => setSelectedType('product')}
                            className={`px-3 py-1 text-xs font-medium rounded-full transition-all flex items-center gap-1.5 whitespace-nowrap ${
                                selectedType === 'product'
                                    ? 'bg-emerald-500 text-white shadow-sm'
                                    : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
                            }`}
                        >
                            <CubeIcon className="h-3.5 w-3.5" />
                            Product
                        </button>
                        <button
                            onClick={() => setSelectedType('job')}
                            className={`px-3 py-1 text-xs font-medium rounded-full transition-all flex items-center gap-1.5 whitespace-nowrap ${
                                selectedType === 'job'
                                    ? 'bg-indigo-500 text-white shadow-sm'
                                    : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
                            }`}
                        >
                            <ClipboardDocumentListIcon className="h-3.5 w-3.5" />
                            Job
                        </button>
                        <button
                            onClick={() => setSelectedType('po')}
                            className={`px-3 py-1 text-xs font-medium rounded-full transition-all flex items-center gap-1.5 whitespace-nowrap ${
                                selectedType === 'po'
                                    ? 'bg-amber-500 text-white shadow-sm'
                                    : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
                            }`}
                        >
                            <ShoppingCartIcon className="h-3.5 w-3.5" />
                            <span className="sm:hidden">PO</span>
                            <span className="hidden sm:inline">Purchase Order</span>
                        </button>
                    </div>


                    {/* Results Area */}
                    <div className="flex-1 overflow-y-auto py-2 max-h-[60vh] sm:max-h-[60vh]">
                        {query.trim() && hasResults ? (
                            <>
                                {/* Jobs Section */}
                                {groupedResults.jobs.length > 0 && (
                                    <div className="py-2">
                                        <h3 className="px-4 pb-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">Jobs</h3>
                                        <ul className="text-sm text-gray-700">
                                            {groupedResults.jobs.map((result, idx) => {
                                                const globalIdx = searchResults.findIndex(r => r.id === result.id && r.type === 'job');
                                                const job = result.data as Job;
                                                return (
                                                    <li key={result.id}>
                                                        <button
                                                            ref={(el) => { resultRefs.current[globalIdx] = el; }}
                                                            onClick={() => handleNavigate(result.path, result.title)}
                                                            className={`group flex w-full items-center px-4 py-2 transition-colors ${
                                                                activeIndex === globalIdx
                                                                    ? 'bg-blue-100 border-l-2 border-blue-500'
                                                                    : 'hover:bg-blue-50/80'
                                                            }`}
                                                            aria-selected={activeIndex === globalIdx}
                                                        >
                                                            <div className={`flex h-8 w-8 flex-none items-center justify-center rounded-lg ${result.iconBg} group-hover:opacity-80 ${result.iconColor}`}>
                                                                <result.icon className="h-5 w-5" />
                                                            </div>
                                                            <div className="ml-3 flex-auto truncate text-left">
                                                                <div className="flex justify-between">
                                                                    <p className="font-medium text-gray-900">{renderHighlighted(cleanText(result.title), query)}</p>
                                                                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 ml-2">
                                                                        {job.status}
                                                                    </span>
                                                                </div>
                                                                <p className="text-xs text-gray-500 truncate">{renderHighlighted(cleanText(result.subtitle), query)}</p>
                                                                {job.dueDate && (
                                                                    <p className="text-xs text-gray-400 mt-0.5">
                                                                        Due: {formatDate(job.dueDate)}
                                                                    </p>
                                                                )}
                                                            </div>
                                                            <ArrowRightIcon className="ml-3 h-4 w-4 flex-none text-gray-300 group-hover:text-indigo-600" />
                                                        </button>
                                                    </li>
                                                );
                                            })}
                                        </ul>
                                    </div>
                                )}

                                {/* Products Section */}
                                {groupedResults.products.length > 0 && (
                                    <div className="py-2">
                                        <h3 className="px-4 pb-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">Products</h3>
                                        {(() => {
                                            const grouped = groupedResults.products.reduce((acc, product) => {
                                                const p = product.data as Product;
                                                const gId = p.groupId || 'other';
                                                if (!acc[gId]) acc[gId] = [];
                                                acc[gId].push(product);
                                                return acc;
                                            }, {} as Record<string, typeof groupedResults.products>);

                                            return Object.entries(grouped)
                                                .sort(([a], [b]) => {
                                                    if (a === 'other') return 1;
                                                    if (b === 'other') return -1;
                                                    const nameA = groups.find(g => g.id === a)?.name || '';
                                                    const nameB = groups.find(g => g.id === b)?.name || '';
                                                    return nameA.localeCompare(nameB);
                                                })
                                                .map(([groupId, products]) => (
                                                    <div key={groupId} className="mb-0">
                                                        <div className="sticky top-0 z-10 bg-gray-50/95 backdrop-blur px-4 py-1.5 border-y border-gray-100 text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                                                            {groupId === 'other' ? 'Uncategorized' : (groups.find(g => g.id === groupId)?.name || 'Unknown')}
                                                        </div>
                                                        <ul className="text-sm text-gray-700">
                                                            {products.map((result) => {
                                                                const globalIdx = searchResults.findIndex(r => r.id === result.id && r.type === 'product');
                                                                const product = result.data as Product;
                                                                return (
                                                                    <li key={result.id}>
                                                                        <button
                                                                            ref={(el) => { resultRefs.current[globalIdx] = el; }}
                                                                            onClick={() => handleNavigate(result.path, result.title)}
                                                                            className={`group flex w-full items-center px-4 py-2 transition-colors ${
                                                                                activeIndex === globalIdx
                                                                                    ? 'bg-blue-100 border-l-2 border-blue-500'
                                                                                    : 'hover:bg-blue-50/80'
                                                                            }`}
                                                                            aria-selected={activeIndex === globalIdx}
                                                                        >
                                                                            <div className={`flex h-8 w-8 flex-none items-center justify-center rounded-lg ${result.iconBg} group-hover:opacity-80 ${result.iconColor}`}>
                                                                                <result.icon className="h-5 w-5" />
                                                                            </div>
                                                                            <div className="ml-3 flex-auto min-w-0 text-left">
                                                                                <div className="flex justify-between items-center">
                                                                                    <p className="font-medium text-gray-900 truncate mr-2">{renderHighlighted(cleanText(result.title), query)}</p>
                                                                                    <span className="text-xs font-mono bg-emerald-50 text-emerald-700 px-1.5 rounded flex-shrink-0 whitespace-nowrap">
                                                                                        {/* @ts-ignore */}
                                                                                        {product.quantity || product.quantityBox || 0} in stock
                                                                                    </span>
                                                                                </div>
                                                                                <p className="text-xs text-gray-500 truncate">{renderHighlighted(cleanText(result.subtitle), query)}</p>
                                                                            </div>
                                                                            <ArrowRightIcon className="ml-3 h-4 w-4 flex-none text-gray-300 group-hover:text-emerald-600" />
                                                                        </button>
                                                                    </li>
                                                                );
                                                            })}
                                                        </ul>
                                                    </div>
                                                ));
                                        })()}
                                    </div>
                                )}

                                {/* POs Section */}
                                {groupedResults.pos.length > 0 && (
                                    <div className="py-2">
                                        <h3 className="px-4 pb-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">Purchase Orders</h3>
                                        <ul className="text-sm text-gray-700">
                                            {groupedResults.pos.map((result) => {
                                                const globalIdx = searchResults.findIndex(r => r.id === result.id && r.type === 'po');
                                                const po = result.data as PurchaseOrder;
                                                return (
                                                    <li key={result.id}>
                                                        <button
                                                            ref={(el) => { resultRefs.current[globalIdx] = el; }}
                                                            onClick={() => handleNavigate(result.path, result.title)}
                                                            className={`group flex w-full items-center px-4 py-2 transition-colors ${
                                                                activeIndex === globalIdx
                                                                    ? 'bg-blue-100 border-l-2 border-blue-500'
                                                                    : 'hover:bg-blue-50/80'
                                                            }`}
                                                            aria-selected={activeIndex === globalIdx}
                                                        >
                                                            <div className={`flex h-8 w-8 flex-none items-center justify-center rounded-lg ${result.iconBg} group-hover:opacity-80 ${result.iconColor}`}>
                                                                <result.icon className="h-5 w-5" />
                                                            </div>
                                                            <div className="ml-3 flex-auto truncate text-left">
                                                                <div className="flex justify-between">
                                                                    <p className="font-medium text-gray-900">{renderHighlighted(cleanText(result.title), query)}</p>
                                                                    <span className={`text-[10px] px-2 py-0.5 rounded-full ${po.status === 'Received' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                                                                        {po.status}
                                                                    </span>
                                                                </div>
                                                                <p className="text-xs text-gray-500 truncate">{renderHighlighted(cleanText(result.subtitle), query)}</p>
                                                            </div>
                                                            <ArrowRightIcon className="ml-3 h-4 w-4 flex-none text-gray-300 group-hover:text-amber-600" />
                                                        </button>
                                                    </li>
                                                );
                                            })}
                                        </ul>
                                    </div>
                                )}
                            </>
                        ) : query.trim() ? (
                            <div className="px-6 py-14 text-center text-sm sm:px-14">
                                <MagnifyingGlassIcon className="mx-auto h-6 w-6 text-gray-400" aria-hidden="true" />
                                <p className="mt-4 font-semibold text-gray-900">No results found</p>
                                <p className="mt-2 text-gray-500">
                                    We couldn't find anything with that term. Try a different search or check spelling.
                                </p>
                            </div>
                        ) : showSuggestions ? (
                            <div className="px-4 py-4">
                                {query.trim() === '' && recentSearches.length > 0 && (
                                    <div className="mb-4">
                                        <h3 className="px-2 pb-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">Recent Searches</h3>
                                        <div className="flex flex-wrap gap-2 px-2">
                                            {recentSearches.slice(0, 8).map((term, idx) => (
                                                <button
                                                    key={idx}
                                                    onClick={() => handleSuggestionClick(term)}
                                                    className="px-3 py-1.5 text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-full transition-colors"
                                                >
                                                    {term}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                                {autoSuggestions.length > 0 && (
                                    <div>
                                        <h3 className="px-2 pb-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">Suggestions</h3>
                                        <ul className="space-y-1">
                                            {autoSuggestions.map((suggestion, idx) => (
                                                <li key={idx}>
                                                    <button
                                                        onClick={() => handleSuggestionClick(suggestion)}
                                                        className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-lg transition-colors"
                                                    >
                                                        {renderHighlighted(suggestion, query)}
                                                    </button>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="px-6 py-14 text-center text-sm sm:px-14">
                                <MagnifyingGlassIcon className="mx-auto h-6 w-6 text-gray-400" aria-hidden="true" />
                                <p className="mt-4 font-semibold text-gray-900">Search for anything</p>
                                <p className="mt-2 text-gray-500">
                                    Search for jobs by code, products by name/sku, or purchase orders.
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="bg-gray-50/50 px-4 py-3 border-t border-gray-200/50 flex justify-between items-center">
                        <span className="text-xs text-gray-400">
                            {hasResults && (
                                <span className="mr-4">{searchResults.length} result{searchResults.length !== 1 ? 's' : ''}</span>
                            )}
                            <kbd className="font-sans font-semibold text-gray-500">↑↓</kbd> to navigate, <kbd className="font-sans font-semibold text-gray-500">Enter</kbd> to select, <kbd className="font-sans font-semibold text-gray-500">ESC</kbd> to close
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
};
