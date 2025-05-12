'use client';

import React from 'react';

interface SkeletonProps {
  className?: string;
  width?: string | number;
  height?: string | number;
  borderRadius?: string;
  animate?: boolean;
}

/**
 * A basic skeleton loader component that can be used to create skeleton UI elements
 */
const SkeletonLoader = ({
  className = '',
  width = '100%',
  height = '1rem',
  borderRadius = '0.25rem',
  animate = true,
}: SkeletonProps) => {
  return (
    <div
      className={`bg-gray-200 ${animate ? 'animate-pulse' : ''} ${className}`}
      style={{
        width: typeof width === 'number' ? `${width}px` : width,
        height: typeof height === 'number' ? `${height}px` : height,
        borderRadius,
      }}
    />
  );
};

export default SkeletonLoader;

/**
 * A skeleton for text lines with multiple lines and varying widths
 */
export function TextSkeleton({
  lines = 1,
  className = '',
  lineHeight = '1rem',
  lastLineWidth = '100%',
  spacing = '0.5rem',
}: {
  lines?: number;
  className?: string;
  lineHeight?: string | number;
  lastLineWidth?: string | number;
  spacing?: string | number;
}) {
  return (
    <div className={`space-y-${typeof spacing === 'string' ? spacing : `[${spacing}px]`} ${className}`}>
      {Array.from({ length: lines }).map((_, index) => (
        <SkeletonLoader
          key={index}
          height={lineHeight}
          width={index === lines - 1 && lines > 1 ? lastLineWidth : '100%'}
        />
      ))}
    </div>
  );
}

/**
 * A skeleton for a card with a title and content
 */
export function CardSkeleton({
  className = '',
  height = '12rem',
  titleHeight = '1.5rem',
  contentLines = 3,
}: {
  className?: string;
  height?: string | number;
  titleHeight?: string | number;
  contentLines?: number;
}) {
  return (
    <div
      className={`bg-white rounded-lg shadow-md p-6 ${className}`}
      style={{
        height: typeof height === 'number' ? `${height}px` : height,
      }}
    >
      <SkeletonLoader
        height={titleHeight}
        width="60%"
        className="mb-4"
        borderRadius="0.375rem"
      />
      <TextSkeleton lines={contentLines} spacing="1rem" lastLineWidth="80%" />
    </div>
  );
}

/**
 * A skeleton for a table with rows and columns
 */
export function TableSkeleton({
  rows = 5,
  columns = 4,
  className = '',
  headerHeight = '3rem',
  rowHeight = '3.5rem',
  showHeader = true,
}: {
  rows?: number;
  columns?: number;
  className?: string;
  headerHeight?: string | number;
  rowHeight?: string | number;
  showHeader?: boolean;
}) {
  return (
    <div className={`bg-white rounded-lg shadow-md overflow-hidden ${className}`}>
      {showHeader && (
        <div
          className="bg-gray-50 px-6"
          style={{
            height: typeof headerHeight === 'number' ? `${headerHeight}px` : headerHeight,
          }}
        >
          <div className="grid grid-cols-12 gap-4 items-center h-full">
            {Array.from({ length: columns }).map((_, index) => (
              <SkeletonLoader
                key={`header-${index}`}
                height="0.75rem"
                width={`${Math.floor(Math.random() * 30) + 50}%`}
                className={`col-span-${Math.ceil(12 / columns)}`}
              />
            ))}
          </div>
        </div>
      )}
      <div>
        {Array.from({ length: rows }).map((_, rowIndex) => (
          <div
            key={`row-${rowIndex}`}
            className={`px-6 ${rowIndex < rows - 1 ? 'border-b border-gray-200' : ''}`}
            style={{
              height: typeof rowHeight === 'number' ? `${rowHeight}px` : rowHeight,
            }}
          >
            <div className="grid grid-cols-12 gap-4 items-center h-full">
              {Array.from({ length: columns }).map((_, colIndex) => (
                <SkeletonLoader
                  key={`cell-${rowIndex}-${colIndex}`}
                  height="0.875rem"
                  width={`${Math.floor(Math.random() * 40) + 60}%`}
                  className={`col-span-${Math.ceil(12 / columns)}`}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * A skeleton for a graph or chart
 */
export function GraphSkeleton({
  className = '',
  height = '20rem',
  showControls = true,
}: {
  className?: string;
  height?: string | number;
  showControls?: boolean;
}) {
  return (
    <div className={`bg-white rounded-lg shadow-md p-6 ${className}`}>
      {showControls && (
        <div className="flex justify-between items-center mb-6">
          <SkeletonLoader height="1.5rem" width="30%" borderRadius="0.375rem" />
          <div className="flex space-x-4">
            <SkeletonLoader height="2rem" width="5rem" borderRadius="0.375rem" />
            <SkeletonLoader height="2rem" width="5rem" borderRadius="0.375rem" />
            <SkeletonLoader height="2rem" width="5rem" borderRadius="0.375rem" />
          </div>
        </div>
      )}
      <div
        style={{
          height: typeof height === 'number' ? `${height}px` : height,
        }}
        className="relative"
      >
        <SkeletonLoader className="absolute inset-0" animate={false} />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-700 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading chart data...</p>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * A skeleton for a detail view with sections
 */
export function DetailSkeleton({
  className = '',
  sections = 3,
  sectionHeight = '12rem',
}: {
  className?: string;
  sections?: number;
  sectionHeight?: string | number;
}) {
  return (
    <div className={`space-y-6 ${className}`}>
      {Array.from({ length: sections }).map((_, index) => (
        <CardSkeleton
          key={`section-${index}`}
          height={sectionHeight}
          contentLines={4}
        />
      ))}
    </div>
  );
}
