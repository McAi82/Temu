// src/components/ui/Pagination.jsx

import React from 'react';
import { Button } from './button';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export const Pagination = ({ 
  currentPage, 
  totalPages, 
  onPageChange,
  itemsPerPage = 20,
  totalItems = 0,
}) => {
  if (totalPages <= 1) {
    return null;
  }

  const handlePrevious = () => {
    if (currentPage > 1) {
      onPageChange(currentPage - 1);
    }
  };

  const handleNext = () => {
    if (currentPage < totalPages) {
      onPageChange(currentPage + 1);
    }
  };

  // Generate page numbers to display
  const getPageNumbers = () => {
    const pages = [];
    const maxVisible = 5;
    
    if (totalPages <= maxVisible) {
      // Show all pages
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      // Show first page, last page, and pages around current
      pages.push(1);
      
      let start = Math.max(2, currentPage - 1);
      let end = Math.min(totalPages - 1, currentPage + 1);
      
      if (currentPage <= 2) {
        start = 2;
        end = 4;
      }
      
      if (currentPage >= totalPages - 1) {
        start = totalPages - 3;
        end = totalPages - 1;
      }
      
      if (start > 2) {
        pages.push('...');
      }
      
      for (let i = start; i <= end; i++) {
        pages.push(i);
      }
      
      if (end < totalPages - 1) {
        pages.push('...');
      }
      
      pages.push(totalPages);
    }
    
    return pages;
  };

  const pageNumbers = getPageNumbers();

  return (
    <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200">
      <div className="flex-1 flex justify-between sm:hidden">
        <Button
          variant="outline"
          size="sm"
          onClick={handlePrevious}
          disabled={currentPage <= 1}
          className="border-[#16233F]/20 text-[#16233F] hover:bg-[#E9ECF2]"
        >
          Previous
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handleNext}
          disabled={currentPage >= totalPages}
          className="border-[#16233F]/20 text-[#16233F] hover:bg-[#E9ECF2]"
        >
          Next
        </Button>
      </div>
      
      <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
        <div>
          <p className="text-sm text-[#64748B] font-['Inter']">
            Showing page <span className="font-medium text-[#16233F]">{currentPage}</span> of{' '}
            <span className="font-medium text-[#16233F]">{totalPages}</span>
            {totalItems > 0 && (
              <span className="ml-1">
                ({totalItems} total items)
              </span>
            )}
          </p>
        </div>
        <div>
          <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
            <Button
              variant="outline"
              size="sm"
              onClick={handlePrevious}
              disabled={currentPage <= 1}
              className="rounded-l-md border-[#16233F]/20 text-[#16233F] hover:bg-[#E9ECF2] disabled:opacity-50"
            >
              <ChevronLeft className="w-4 h-4" />
              <span className="sr-only">Previous</span>
            </Button>
            
            {pageNumbers.map((page, index) => {
              if (page === '...') {
                return (
                  <span
                    key={`ellipsis-${index}`}
                    className="relative inline-flex items-center px-4 py-2 text-sm font-medium text-[#64748B] bg-white border border-[#E9ECF2]"
                  >
                    …
                  </span>
                );
              }
              
              const isActive = page === currentPage;
              
              return (
                <Button
                  key={page}
                  variant={isActive ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => onPageChange(page)}
                  className={`relative inline-flex items-center px-4 py-2 text-sm font-medium ${
                    isActive
                      ? 'bg-[#16233F] text-white hover:bg-[#0F1A2E] border-[#16233F]'
                      : 'border-[#E9ECF2] text-[#16233F] hover:bg-[#E9ECF2]'
                  }`}
                >
                  {page}
                </Button>
              );
            })}
            
            <Button
              variant="outline"
              size="sm"
              onClick={handleNext}
              disabled={currentPage >= totalPages}
              className="rounded-r-md border-[#16233F]/20 text-[#16233F] hover:bg-[#E9ECF2] disabled:opacity-50"
            >
              <span className="sr-only">Next</span>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </nav>
        </div>
      </div>
    </div>
  );
};

export default Pagination;