'use client';

import React, { useMemo, useState, useCallback, useEffect, useRef } from 'react';
import { scaleTime, scaleLinear } from '@visx/scale';
import { Group } from '@visx/group';
import { AxisBottom, AxisLeft } from '@visx/axis';
import { TooltipWithBounds, useTooltip } from '@visx/tooltip';
import { LinePath } from '@visx/shape';
import { motion } from 'framer-motion';
import confetti from 'canvas-confetti';
import { localPoint } from '@visx/event';

import { 
  MedicationEvent,
  OutcomeMarker,
  MedGuideline,
  AppointmentDot,
  MedicationLine,
  MedicationPoint
} from '@/app/lib/types';
import { 
  getMedicationColor,
  getStandardMaxDose,
  formatTooltipText,
  computeDoseRatio,
  getDoseRange,
  generateRelativeTicks
} from '@/app/utils/medicationUtils';
import { useKonami } from '@/app/hooks/useKonami';

interface TimelineChartProps {
  width: number;
  height: number;
  events: MedicationEvent[];
  outcomeMarkers: OutcomeMarker[];
  guidelines: MedGuideline[];
  appointmentDots: AppointmentDot[];
  version?: 'separated' | 'combined';
}

interface PointData {
  x: number;
  y: number;
  original: MedicationPoint;
}

interface ExtendedTooltipData extends MedicationPoint {
  medName: string;
  color?: string;
  overlappingMeds?: Array<{
    medName: string;
    doseMg: number;
    color?: string;
  }>;
}

const MARGIN = { top: 20, right: 40, bottom: 60, left: 80 };
const EVENT_CIRCLE_RADIUS = 5;
const APPOINTMENT_CIRCLE_RADIUS = 4;
const VERTICAL_OFFSET_STEP = 15;
const HOVER_THRESHOLD = 50; // pixels
const THROTTLE_DELAY = 16; // ~60fps

export default function TimelineChart({
  width,
  height,
  events,
  outcomeMarkers,
  guidelines,
  appointmentDots,
  version = 'separated'
}: TimelineChartProps) {
  const { isRainbow } = useKonami();
  const [hasShownConfetti, setHasShownConfetti] = useState(false);
  const lastUpdateRef = useRef<number>(0);
  const isHoveringRef = useRef<boolean>(false);
  
  const {
    tooltipData,
    tooltipLeft,
    tooltipTop,
    tooltipOpen,
    showTooltip,
    hideTooltip,
  } = useTooltip<ExtendedTooltipData>();

  // Calculate bounds
  const xMax = width - MARGIN.left - MARGIN.right;
  const yMax = height - MARGIN.top - MARGIN.bottom;

  // Date range: calculated from actual event data
  const dateRange = useMemo(() => {
    if (events.length === 0) {
      // Fallback to last 12 months if no events
      const now = new Date();
      const twelveMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 12, 1);
      return [twelveMonthsAgo, now];
    }

    // Parse all event dates and find min/max
    const allDates = events.map(event => new Date(event.date));
    const minDate = new Date(Math.min(...allDates.map(d => d.getTime())));
    const maxDate = new Date(Math.max(...allDates.map(d => d.getTime())));
    
    // Add some padding to the range
    const padding = (maxDate.getTime() - minDate.getTime()) * 0.1; // 10% padding
    const paddedMinDate = new Date(minDate.getTime() - padding);
    const paddedMaxDate = new Date(maxDate.getTime() + padding);
    
    return [paddedMinDate, paddedMaxDate];
  }, [events]);

  // Process events into medication lines
  const medicationLines = useMemo(() => {
    const lineMap = new Map<string, MedicationLine>();

    // Group events by medication
    const eventsByMed = events.reduce((acc, event) => {
      if (!acc[event.medId]) acc[event.medId] = [];
      acc[event.medId].push(event);
      return acc;
    }, {} as Record<string, MedicationEvent[]>);

    // Create lines for each medication
    Object.entries(eventsByMed).forEach(([medId, medEvents]) => {
      const sortedEvents = medEvents.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      const firstEvent = sortedEvents[0];
      const lastEvent = sortedEvents[sortedEvents.length - 1];
      
      const isActive = lastEvent.type !== 'stop';
      const points: MedicationPoint[] = [];

      // Add points for all events with dose information
      sortedEvents.forEach(event => {
        const eventDate = new Date(event.date);
        if (event.doseMg !== undefined) {
          points.push({
            date: eventDate,
            doseMg: event.doseMg,
            isAppointment: false
          });
        }
      });

      // Add appointment dots
      appointmentDots
        .filter(dot => dot.medId === medId)
        .forEach(dot => {
          const dotDate = new Date(dot.date);
          points.push({
            date: dotDate,
            doseMg: dot.doseMg,
            isAppointment: true,
            appointmentType: dot.appointmentType
          });
        });

      // Sort points by date
      points.sort((a, b) => a.date.getTime() - b.date.getTime());

      lineMap.set(medId, {
        medId,
        medName: firstEvent.medName,
        color: getMedicationColor(firstEvent.medName),
        points,
        startedOverYearAgo: false, // Not relevant for this visualization
        isActive
      });
    });

    return Array.from(lineMap.values());
  }, [events, appointmentDots]);

  // Calculate relative dosage range (always 0-1 for relative scaling)
  const dosageRange = [0, 1];

  // Scales
  const xScale = useMemo(() => {
    return scaleTime<number>({
      range: [0, xMax],
      domain: dateRange,
    });
  }, [xMax, dateRange]);

  const yScale = useMemo(() => {
    return scaleLinear<number>({
      range: [yMax, 0], // Invert for proper chart orientation
      domain: dosageRange,
    });
  }, [yMax, dosageRange]);

  // Function to get overlapping medications at a point
  const getOverlappingMeds = useCallback((date: Date, currentMedId: string) => {
    return medicationLines
      .filter(line => line.medId !== currentMedId)
      .filter(line => {
        const points = line.points;
        if (points.length < 2) return false;
        const startDate = points[0].date;
        const endDate = points[points.length - 1].date;
        return date >= startDate && date <= endDate;
      })
      .map(line => {
        const points = line.points;
        const prevPoint = points.find(p => p.date <= date);
        const nextPoint = points.find(p => p.date > date);
        let doseMg = prevPoint?.doseMg || 0;
        
        // Interpolate dose if between points
        if (prevPoint && nextPoint) {
          const timeDiff = nextPoint.date.getTime() - prevPoint.date.getTime();
          const timeProgress = (date.getTime() - prevPoint.date.getTime()) / timeDiff;
          doseMg = prevPoint.doseMg + (nextPoint.doseMg - prevPoint.doseMg) * timeProgress;
        }
        
        return {
          medName: line.medName,
          doseMg,
          color: line.color
        };
      });
  }, [medicationLines]);

  // Handle mouse move for tooltips with throttling and bounds checking
  const handleMouseMove = useCallback((event: React.MouseEvent) => {
    const now = Date.now();
    if (now - lastUpdateRef.current < THROTTLE_DELAY) {
      return;
    }
    lastUpdateRef.current = now;

    const point = localPoint(event);
    if (!point) return;

    const x = point.x - MARGIN.left;
    const y = point.y - MARGIN.top;

    // Check if mouse is within chart bounds
    if (x < 0 || x > xMax || y < 0 || y > yMax) {
      if (isHoveringRef.current) {
        hideTooltip();
        isHoveringRef.current = false;
      }
      return;
    }

    isHoveringRef.current = true;
    const xDate = xScale.invert(x);

    // Find the closest point using simplified logic
    let closestPoint: { line: MedicationLine; point: MedicationPoint } | null = null;
    let minDistance = Infinity;

    medicationLines.forEach(medLine => {
      medLine.points.forEach(medPoint => {
        const distance = Math.abs(medPoint.date.getTime() - xDate.getTime());
        if (distance < minDistance) {
          minDistance = distance;
          closestPoint = { line: medLine, point: medPoint };
        }
      });
    });

    if (closestPoint && minDistance < 24 * 60 * 60 * 1000) { // Within 1 day
      const line = closestPoint.line;
      const point = closestPoint.point;
      const overlappingMeds = version === 'combined' ? getOverlappingMeds(point.date, line.medId) : undefined;

      const tooltipData: ExtendedTooltipData = {
        date: point.date,
        doseMg: point.doseMg,
        isAppointment: point.isAppointment,
        appointmentType: point.appointmentType,
        medName: line.medName,
        color: line.color,
        overlappingMeds
      };

      showTooltip({
        tooltipData,
        tooltipLeft: xScale(point.date) + MARGIN.left,
        tooltipTop: yScale(point.doseMg / getStandardMaxDose(line.medName)) + MARGIN.top
      });
    } else if (isHoveringRef.current) {
      hideTooltip();
    }
  }, [showTooltip, hideTooltip, xScale, yScale, medicationLines, xMax, yMax, version, getOverlappingMeds]);

  // Handle mouse leave to ensure tooltip is hidden
  const handleMouseLeave = useCallback(() => {
    isHoveringRef.current = false;
    hideTooltip();
  }, [hideTooltip]);

  // Render medication lines
  const renderMedicationLine = useCallback((line: MedicationLine, index: number) => {
    if (line.points.length < 2) return null;

    const standardMaxDose = getStandardMaxDose(line.medName);
    const points: PointData[] = line.points.map(point => ({
      x: xScale(point.date),
      y: yScale(point.doseMg / standardMaxDose),
      original: point
    }));

    // Add vertical offset for separated version with increased step
    const verticalOffset = version === 'separated' ? (index * VERTICAL_OFFSET_STEP) : 0;

    // Adjust opacity based on version
    const lineOpacity = version === 'combined' ? 0.8 : 1;

    return (
      <Group key={line.medId}>
        {/* Line */}
        <LinePath
          data={points}
          x={d => d.x}
          y={d => d.y - verticalOffset}
          stroke={isRainbow ? `hsl(${(index * 60) % 360}, 70%, 50%)` : line.color}
          strokeWidth={2}
          strokeOpacity={line.isActive ? lineOpacity : lineOpacity * 0.5}
          strokeDasharray={line.isActive ? undefined : '4,4'}
        />

        {/* Points */}
        {points.map((point, i) => (
          <circle
            key={`${line.medId}-${i}`}
            cx={point.x}
            cy={point.y - verticalOffset}
            r={point.original.isAppointment ? APPOINTMENT_CIRCLE_RADIUS : EVENT_CIRCLE_RADIUS}
            fill={isRainbow ? `hsl(${(index * 60) % 360}, 70%, 50%)` : line.color}
            stroke="white"
            strokeWidth={1.5}
            style={{ cursor: 'pointer' }}
            opacity={line.isActive ? 1 : 0.5}
          />
        ))}
      </Group>
    );
  }, [xScale, yScale, isRainbow, version]);

  // Check for medication stability confetti
  useEffect(() => {
    if (hasShownConfetti || typeof window === 'undefined') return;
    
    const confettiFired = localStorage.getItem('confettiFired');
    if (confettiFired) return;

    const activeLines = medicationLines.filter(line => line.isActive);
    
    // Fire confetti if we have multiple active medications with outcome markers
    if (activeLines.length >= 2 && outcomeMarkers.length > 0) {
      setTimeout(() => {
        confetti({ 
          particleCount: 80, 
          spread: 70,
          origin: { y: 0.6 }
        });
        localStorage.setItem('confettiFired', '1');
        setHasShownConfetti(true);
      }, 1000);
    }
      }, [medicationLines, outcomeMarkers, hasShownConfetti]);

  // Validate dimensions to prevent rendering issues
  if (width < 100 || height < 100) {
    return (
      <div style={{ width, height }} className="flex items-center justify-center text-gray-500">
        Chart too small to display
      </div>
    );
  }

  return (
    <div className="relative w-full h-full">
      <svg 
        width={width} 
        height={height} 
        className={`${isRainbow ? 'animate-pulse' : ''} overflow-visible`}
        style={{ display: 'block' }}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        <rect width={width} height={height} fill="transparent" />
        
        <Group left={MARGIN.left} top={MARGIN.top}>
          {/* Medication lines */}
          {medicationLines.map((line, index) => renderMedicationLine(line, index))}

          {/* Outcome markers */}
          {outcomeMarkers.map((marker, index) => {
            if (marker.percentChange >= -50) return null;
            
            const markerDate = new Date(marker.date);
            
            // Find the medication line and approximate dose at this date
            const line = medicationLines.find(l => l.medId === marker.medId);
            if (!line) return null;
            
            const x = xScale(markerDate);
            const y = 10; // Fixed position at top
            
            return (
              <motion.text
                key={`outcome-${marker.medId}-${marker.date}`}
                x={x}
                y={y}
                textAnchor="middle"
                fontSize={16}
                initial={{ scale: 0, y: y + 20 }}
                animate={{ scale: 1, y: y }}
                transition={{ duration: 0.5, delay: 1.5 + index * 0.2 }}
                style={{ cursor: 'help' }}
              >
                🥳
              </motion.text>
            );
          })}

          {/* Axes */}
          <AxisBottom
            top={yMax}
            scale={xScale}
            numTicks={4} // Every 3rd month as requested
            tickFormat={(value) => {
              const date = value as Date;
              return date.toLocaleDateString('en-US', { 
                month: 'short', 
                year: '2-digit' 
              });
            }}
            tickLabelProps={() => ({
              fill: 'currentColor',
              fontSize: 11,
              textAnchor: 'middle',
            })}
          />
          
          <AxisLeft
            scale={yScale}
            tickValues={generateRelativeTicks(5).map(tick => tick.ratio)}
            tickFormat={(value) => {
              const ticks = generateRelativeTicks(5);
              const tick = ticks.find(t => Math.abs(t.ratio - Number(value)) < 0.001);
              return tick?.label || '';
            }}
            tickLabelProps={() => ({
              fill: 'currentColor',
              fontSize: 11,
              textAnchor: 'end',
              dx: -5,
            })}
          />

          {/* Y-axis label */}
          <text
            x={-50}
            y={yMax / 2}
            textAnchor="middle"
            fontSize={12}
            fill="currentColor"
            transform={`rotate(-90, -50, ${yMax / 2})`}
          >
            Relative Dose
          </text>
        </Group>
      </svg>

      {/* Tooltip */}
      {tooltipOpen && tooltipData && (
        <TooltipWithBounds
          key={Math.random()}
          top={tooltipTop}
          left={tooltipLeft}
          style={{
            backgroundColor: 'rgba(0, 0, 0, 0.9)',
            color: 'white',
            fontSize: '12px',
            padding: '8px 12px',
            borderRadius: '6px',
            maxWidth: version === 'combined' ? '250px' : '200px',
            whiteSpace: 'pre-line',
            pointerEvents: 'none',
            zIndex: 1000
          }}
        >
          <div className="font-medium" style={{ color: tooltipData.color || 'white' }}>
            {tooltipData.medName}
          </div>
          <div className="text-gray-300">
            {tooltipData.doseMg}mg
            {tooltipData.isAppointment && ` - ${tooltipData.appointmentType || 'Appointment'}`}
          </div>
          <div className="text-gray-400 text-xs">
            {tooltipData.date.toLocaleDateString()}
          </div>
          {version === 'combined' && tooltipData.overlappingMeds && tooltipData.overlappingMeds.length > 0 && (
            <div className="mt-2 pt-2 border-t border-gray-600">
              <div className="text-xs text-gray-400 mb-1">Other medications on this day:</div>
              {tooltipData.overlappingMeds.map((med, i) => (
                <div key={i} className="text-sm" style={{ color: med.color || 'white' }}>
                  {med.medName}: {med.doseMg}mg
                </div>
              ))}
            </div>
          )}
        </TooltipWithBounds>
      )}
    </div>
  );
}

const defaultTooltipStyles = {
  position: 'absolute' as const,
  pointerEvents: 'none' as const,
  zIndex: 1000,
}; 