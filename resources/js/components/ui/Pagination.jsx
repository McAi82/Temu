// src/components/ui/Pagination.jsx
import React from 'react';
import { Button } from './button';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const CELL = 36; // px, width/height of each page cell
const GAP = 4;   // px, gap between cells

export const Pagination = ({
  currentPage,
  totalPages,
  onPageChange,
  itemsPerPage = 20,
  totalItems = 0,
}) => {
  const from = totalItems > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0;
  const to = totalItems > 0 ? Math.min(currentPage * itemsPerPage, totalItems) : 0;

  // One page or none: nothing to flip through, just show the count
  if (totalPages <= 1) {
    if (totalItems <= 0) return null;
    return (
      <p className="mt-4 px-1 text-sm text-[#64748B] font-['Inter']">
        Showing <span className="font-medium text-[#16233F]">{totalItems}</span> {totalItems === 1 ? 'item' : 'items'}
      </p>
    );
  }

  const handlePrevious = () => currentPage > 1 && onPageChange(currentPage - 1);
  const handleNext = () => currentPage < totalPages && onPageChange(currentPage + 1);

  // First, last and the pages around the current one, with ellipses between
  const getPageNumbers = () => {
    const pages = [];
    const maxVisible = 5;

    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
      return pages;
    }

    pages.push(1);
    let start = Math.max(2, currentPage - 1);
    let end = Math.min(totalPages - 1, currentPage + 1);
    if (currentPage <= 2) { start = 2; end = 4; }
    if (currentPage >= totalPages - 1) { start = totalPages - 3; end = totalPages - 1; }
    if (start > 2) pages.push('...');
    for (let i = start; i <= end; i++) pages.push(i);
    if (end < totalPages - 1) pages.push('...');
    pages.push(totalPages);
    return pages;
  };

  const pageNumbers = getPageNumbers();
  const activeIndex = pageNumbers.indexOf(currentPage);
  const progress = (currentPage / totalPages) * 100;

  const arrow =
    'w-9 h-9 p-0 rounded-full border-[#16233F]/20 text-[#16233F] hover:bg-[#16233F] hover:text-white disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-[#16233F] transition-colors';

  return (
    <div className="mt-4 rounded-xl bg-white border border-[#E3E7EE] px-4 pt-3 pb-4 font-['Inter']">
      {/* Mobile: previous / position / next */}
      <div className="flex items-center justify-between sm:hidden">
        <Button variant="outline" size="sm" onClick={handlePrevious} disabled={currentPage <= 1}
          className="border-[#16233F]/20 text-[#16233F] hover:bg-[#E9ECF2]">
          Previous
        </Button>
        <span className="text-sm text-[#64748B]">
          <span className="font-medium text-[#16233F]">{currentPage}</span> / {totalPages}
        </span>
        <Button variant="outline" size="sm" onClick={handleNext} disabled={currentPage >= totalPages}
          className="border-[#16233F]/20 text-[#16233F] hover:bg-[#E9ECF2]">
          Next
        </Button>
      </div>

      {/* Desktop */}
      <div className="hidden sm:flex items-center justify-between gap-6">
        <p className="text-sm text-[#64748B]">
          Showing page <span className="font-medium text-[#16233F]">{currentPage}</span> of{' '}
          <span className="font-medium text-[#16233F]">{totalPages}</span>
          {totalItems > 0 && (
            <span className="ml-1">
              (items {from}–{to} of {totalItems})
            </span>
          )}
        </p>

        <nav className="flex items-center gap-2" aria-label="Pagination">
          <Button variant="outline" size="sm" onClick={handlePrevious} disabled={currentPage <= 1} className={arrow}>
            <ChevronLeft className="w-4 h-4" />
            <span className="sr-only">Previous</span>
          </Button>

          {/* The navy marker slides to whichever page is current */}
          <div className="relative flex items-center rounded-full bg-[#E9ECF2] p-1" style={{ gap: GAP }}>
            <span
              aria-hidden="true"
              className="absolute top-1 left-1 rounded-full bg-[#16233F] shadow transition-transform duration-300 ease-out"
              style={{
                width: CELL,
                height: CELL,
                transform: `translateX(${Math.max(activeIndex, 0) * (CELL + GAP)}px)`,
                opacity: activeIndex < 0 ? 0 : 1,
              }}
            />
            {pageNumbers.map((page, index) =>
              page === '...' ? (
                <span key={`ellipsis-${index}`} style={{ width: CELL, height: CELL }}
                  className="relative flex items-center justify-center text-sm text-[#64748B]">
                  …
                </span>
              ) : (
                <button
                  key={page}
                  type="button"
                  onClick={() => onPageChange(page)}
                  aria-current={page === currentPage ? 'page' : undefined}
                  aria-label={`Page ${page}`}
                  style={{ width: CELL, height: CELL }}
                  className={`relative rounded-full text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#F0B429] ${page === currentPage ? 'text-white' : 'text-[#16233F] hover:bg-white'
                    }`}
                >
                  {page}
                </button>
              )
            )}
          </div>

          <Button variant="outline" size="sm" onClick={handleNext} disabled={currentPage >= totalPages} className={arrow}>
            <span className="sr-only">Next</span>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </nav>
      </div>

      {/* Road-style progress through the pages */}
      <div className="mt-3 h-1 rounded-full bg-[#E9ECF2] overflow-hidden" aria-hidden="true">
        <div className="h-full rounded-full bg-[#F0B429] transition-all duration-500 ease-out" style={{ width: `${progress}%` }} />
      </div>
    </div>
  );
};

export default Pagination;