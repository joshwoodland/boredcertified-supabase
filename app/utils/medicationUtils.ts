import { TaperPlan, MedicationSpan } from '@/app/lib/types';

export function computeTaper(
  span: MedicationSpan,
  options: {
    reductionPercent?: number;
    intervalWeeks?: number;
    minDose?: number;
  } = {}
): TaperPlan[] {
  const {
    reductionPercent = 25, // 25% reduction by default
    intervalWeeks = 2,     // Every 2 weeks by default
    minDose = 0
  } = options;

  if (!span.doseMg || span.doseMg <= minDose) {
    return [];
  }

  const plan: TaperPlan[] = [];
  let currentDose = span.doseMg;
  let weekNumber = 0;

  // Add current dose as starting point
  plan.push({
    date: new Date().toISOString(),
    doseMg: currentDose,
    weekNumber,
    notes: 'Current dose'
  });

  while (currentDose > minDose) {
    weekNumber += intervalWeeks;
    const reduction = currentDose * (reductionPercent / 100);
    currentDose = Math.max(currentDose - reduction, minDose);
    
    // Round to nearest reasonable increment
    if (currentDose > 10) {
      currentDose = Math.round(currentDose / 5) * 5; // Round to nearest 5mg
    } else if (currentDose > 1) {
      currentDose = Math.round(currentDose * 2) / 2; // Round to nearest 0.5mg
    } else {
      currentDose = Math.round(currentDose * 10) / 10; // Round to nearest 0.1mg
    }

    const today = new Date();
    const taperDate = new Date(today.getFullYear(), today.getMonth(), today.getDate() + (weekNumber * 7));

    plan.push({
      date: taperDate.toISOString(),
      doseMg: currentDose,
      weekNumber,
      notes: currentDose === minDose ? 'Discontinue' : `${reductionPercent}% reduction`
    });

    if (currentDose === minDose) break;
  }

  return plan;
}

export function renderMarkdownTable(plan: TaperPlan[]): string {
  if (plan.length === 0) {
    return 'No taper plan available.';
  }

  const header = '| Week | Date | Dose (mg) | Notes |\n|------|------|-----------|-------|\n';
  
  const rows = plan.map(step => {
    const date = new Date(step.date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
    
    return `| ${step.weekNumber} | ${date} | ${step.doseMg} | ${step.notes || ''} |`;
  }).join('\n');

  return header + rows;
}

export function barFill(
  mg: number | undefined, 
  max: number | undefined, 
  aboveGuide: boolean
): string {
  if (aboveGuide) return "rgba(255,171,0,0.85)"; // Amber for above guidelines
  if (!mg || !max) return "rgba(59,130,246,0.6)"; // Default blue
  
  const pct = Math.min(mg / max, 1); // Cap at 100%
  return `rgba(59,130,246,${0.3 + pct * 0.7})`; // Darker if higher dose
}

// Medication colors for distinct line visualization
export const MEDICATION_COLORS: Record<string, string> = {
  'Sertraline': '#3B82F6',      // Blue
  'Bupropion': '#EF4444',       // Red
  'Lithium': '#10B981',         // Green
  'Lorazepam': '#F59E0B',       // Orange
  'Fluoxetine': '#8B5CF6',      // Purple
  'Escitalopram': '#EC4899',    // Pink
  'Venlafaxine': '#14B8A6',     // Teal
  'Duloxetine': '#F97316',      // Orange-red
  'Mirtazapine': '#6366F1',     // Indigo
  'default': '#6B7280'          // Gray for unknown meds
};

export function getMedicationColor(medName: string): string {
  return MEDICATION_COLORS[medName] || MEDICATION_COLORS.default;
}

// Standard prescriber's guide starting doses (mg)
export const STANDARD_START_DOSES: Record<string, number> = {
  'Sertraline': 25,
  'Bupropion': 150,
  'Lorazepam': 0.5,
  'Fluoxetine': 10,
  'Escitalopram': 5,
  'Venlafaxine': 37.5,
  'Duloxetine': 30,
  'Mirtazapine': 15,
  'Lithium': 300
};

// Standard prescriber's guide max doses (mg)
export const STANDARD_MAX_DOSES: Record<string, number> = {
  'Sertraline': 200,
  'Bupropion': 450,
  'Lorazepam': 4,
  'Fluoxetine': 80,
  'Escitalopram': 20,
  'Venlafaxine': 375,
  'Duloxetine': 120,
  'Mirtazapine': 60,
  'Lithium': 1500
};

export function getStandardStartDose(medName: string): number {
  return STANDARD_START_DOSES[medName] || 25; // Default 25mg if unknown
}

export function getStandardMaxDose(medName: string): number {
  return STANDARD_MAX_DOSES[medName] || 200; // Default 200mg if unknown
}

// Utility to clamp values between min and max
function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

// Compute dose ratio for relative scaling
export function computeDoseRatio(patientDose: number, startDose: number, maxDose: number): number {
  if (startDose === maxDose) return 0.5; // Fallback for equal start and max
  return clamp((patientDose - startDose) / (maxDose - startDose), 0, 1);
}

// Get dose range for a medication
export function getDoseRange(medName: string): { start: number; max: number } {
  return {
    start: getStandardStartDose(medName),
    max: getStandardMaxDose(medName)
  };
}

// Generate Y-axis ticks for relative scaling
export function generateRelativeTicks(splits: number = 5): Array<{ ratio: number; label?: string }> {
  const ticks: Array<{ ratio: number; label?: string }> = Array.from({ length: splits }, (_, i) => ({
    ratio: i / (splits - 1)
  }));
  
  // Add labels only to first and last ticks
  ticks[0] = { ...ticks[0], label: 'starting dose' };
  ticks[ticks.length - 1] = { ...ticks[ticks.length - 1], label: 'max dose' };
  
  return ticks;
}

export function getDoseChangeIcon(oldDose?: number, newDose?: number): string {
  if (!oldDose || !newDose) return '';
  if (newDose > oldDose) return '▲'; // Increase
  if (newDose < oldDose) return '▼'; // Decrease
  return '●'; // No change
}

export function formatTooltipText(
  type: 'start' | 'dose-change' | 'stop',
  medName: string,
  date: string,
  doseMg?: number,
  note?: string,
  aboveGuideline?: boolean,
  outcomeInfo?: string
): string {
  const dateStr = new Date(date).toLocaleDateString('en-US', {
    month: 'short',
    year: 'numeric'
  });

  let baseText = '';
  
  switch (type) {
    case 'start':
      baseText = `Started ${medName} ${doseMg ? `${doseMg} mg ` : ''}${dateStr}`;
      break;
    case 'dose-change':
      baseText = `${doseMg ? `Changed to ${doseMg} mg ` : ''}${dateStr}`;
      break;
    case 'stop':
      baseText = `Discontinued ${dateStr}${note ? ` – ${note}` : ''}`;
      break;
  }

  if (aboveGuideline) {
    baseText += ' ⚠️ Above recommended max';
  }

  if (outcomeInfo) {
    baseText += ` ${outcomeInfo}`;
  }

  return baseText;
} 