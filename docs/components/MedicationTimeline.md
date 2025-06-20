# Medication Timeline Component

The Medication Timeline is a comprehensive visualization component that displays medication events, dose changes, outcome markers, and provides interactive features for clinical decision-making.

## Overview

The Medication Timeline Modal opens **side-by-side** with existing checklist modals and provides:

- **Visual Timeline**: Shows medication periods with dose-dependent color intensity
- **Dose Change Markers**: Circles with up/down arrows indicating dose modifications
- **Guideline Indicators**: Dashed lines showing recommended maximum doses
- **Outcome Celebrations**: 🥳 emoji markers for significant improvements (≥50% reduction)
- **Smart Taper Generator**: Right-click context menu for automatic taper plan creation
- **Micro-Delights**: Animations, Easter eggs, and confetti for engagement

## Components

### MedicationTimelineModal

Main modal component that orchestrates the entire timeline experience.

```tsx
import { MedicationTimelineModal } from '@/app/components/MedicationTimelineModal';

<MedicationTimelineModal
  open={isOpen}
  onClose={handleClose}
  patientId="patient-123"
/>
```

**Props:**
- `open: boolean` - Controls modal visibility
- `onClose: () => void` - Callback when modal is closed
- `patientId: string` - Patient identifier for data fetching

### TimelineChart

Core visualization component built with VisX.

```tsx
import { TimelineChart } from '@/app/components/TimelineChart';

<TimelineChart
  width={400}
  height={300}
  events={medicationEvents}
  outcomeMarkers={outcomeMarkers}
  guidelines={guidelines}
  onContextMenu={handleRightClick}
/>
```

**Props:**
- `width: number` - Chart width in pixels
- `height: number` - Chart height in pixels
- `events: MedicationEvent[]` - Array of medication events
- `outcomeMarkers: OutcomeMarker[]` - Array of outcome measurements
- `guidelines: MedGuideline[]` - Array of medication guidelines
- `onContextMenu?: (span, x, y) => void` - Right-click handler for taper modal

### TaperModal

Smart taper plan generator with customizable parameters.

```tsx
import { TaperModal } from '@/app/components/TaperModal';

<TaperModal
  span={medicationSpan}
  open={isOpen}
  onClose={handleClose}
/>
```

**Props:**
- `span: MedicationSpan | null` - Medication span for taper calculation
- `open: boolean` - Controls modal visibility
- `onClose: () => void` - Callback when modal is closed

### MedSummaryLists

Displays active and discontinued medications in list format.

```tsx
import { MedSummaryLists } from '@/app/components/MedSummaryLists';

<MedSummaryLists summaries={medicationSummaries} />
```

**Props:**
- `summaries: MedicationSummary[]` - Array of medication summaries

## Data Types

### MedicationEvent

```typescript
interface MedicationEvent {
  medId: string;           // Unique medication identifier
  medName: string;         // Medication name (e.g., "Sertraline")
  date: string;            // ISO date string
  type: "start" | "dose-change" | "stop";
  doseMg?: number;         // Dose in milligrams (null for stop events)
  note?: string;           // Additional notes (e.g., discontinuation reason)
}
```

### MedicationSummary

```typescript
interface MedicationSummary {
  medId: string;
  medName: string;
  isActive: boolean;
  lastDoseMg?: number;
  lastChangeDate: string;  // ISO date string
  stopReason?: string;
}
```

### OutcomeMarker

```typescript
interface OutcomeMarker {
  medId: string;
  date: string;            // ISO date string
  scale: "PHQ-9" | "GAD-7";
  score: number;           // Raw score
  percentChange: number;   // Percentage change (e.g., -55 for 55% improvement)
}
```

### MedGuideline

```typescript
interface MedGuideline {
  medName: string;
  recommendedMaxMg: number; // Maximum recommended dose
}
```

## Features

### Visual Elements

- **Medication Bars**: Horizontal bars showing medication periods
  - Color intensity increases with dose
  - Amber tint for doses above guidelines
  - Dashed outline for discontinued medications

- **Dose Change Markers**: Circular markers with directional arrows
  - ▲ for dose increases
  - ▼ for dose decreases
  - Animated pulse on load

- **Outcome Celebrations**: 🥳 emoji markers
  - Appear for ≥50% improvement in PHQ-9/GAD-7 scores
  - Positioned above medication bars

- **Guideline Lines**: Dashed horizontal lines
  - Show recommended maximum doses
  - Bars above guidelines are highlighted in amber

### Interactive Features

- **Hover Tooltips**: Detailed information on hover
  - Medication start/stop dates
  - Dose information
  - Discontinuation reasons
  - Guideline warnings

- **Right-Click Context Menu**: Opens Smart Taper Modal
  - Customizable reduction percentages (10%, 25%, 50%)
  - Configurable intervals (1, 2, 4 weeks)
  - Markdown table output for easy copying

### Micro-Delights & Easter Eggs

- **Animated Ink Effect**: Bars grow from left to right on load
- **Pulse Animations**: Dose change markers pulse when appearing
- **Konami Code**: Triggers rainbow color cycling (↑↑↓↓←→←→ba)
- **Stability Confetti**: Fires once when all medications are stable for 12+ months

## Usage Examples

### Basic Implementation

```tsx
import { useState } from 'react';
import { MedicationTimelineModal } from '@/app/components/MedicationTimelineModal';

function PatientView({ patientId }) {
  const [showTimeline, setShowTimeline] = useState(false);

  return (
    <div>
      <button onClick={() => setShowTimeline(true)}>
        View Medication Timeline
      </button>
      
      <MedicationTimelineModal
        open={showTimeline}
        onClose={() => setShowTimeline(false)}
        patientId={patientId}
      />
    </div>
  );
}
```

### Side-by-Side with Checklist Modal

```tsx
function ClinicalView({ patientId }) {
  const [showChecklist, setShowChecklist] = useState(false);
  const [showTimeline, setShowTimeline] = useState(false);

  return (
    <>
      {/* Checklist Modal - positioned on the right */}
      <DefaultChecklistModal
        open={showChecklist}
        onClose={() => setShowChecklist(false)}
        patientId={patientId}
        className="ml-[470px]" // Offset for timeline modal
      />
      
      {/* Timeline Modal - positioned on the left */}
      <MedicationTimelineModal
        open={showTimeline}
        onClose={() => setShowTimeline(false)}
        patientId={patientId}
      />
    </>
  );
}
```

## Data Integration

The component uses the `useMedicationTimeline` hook to fetch data:

```typescript
// Replace with your actual API endpoint
const { data, isLoading, error } = useMedicationTimeline(patientId);

// Expected API response format:
{
  events: MedicationEvent[],
  summaries: MedicationSummary[],
  outcomeMarkers: OutcomeMarker[],
  guidelines: MedGuideline[]
}
```

## Accessibility

- **ARIA Labels**: All interactive elements have proper labels
- **Keyboard Navigation**: Full keyboard support
- **Screen Reader Compatible**: Semantic HTML structure
- **High Contrast**: Supports dark mode and high contrast themes
- **Focus Management**: Proper focus trapping in modals

## Customization

### Styling

The component uses Tailwind CSS classes and can be customized via:

- CSS custom properties for colors
- Tailwind configuration for spacing/sizing
- Dark mode support through `dark:` prefixes

### Taper Calculation

The taper algorithm can be customized in `computeTaper()`:

- Reduction percentages
- Time intervals
- Minimum dose thresholds
- Rounding increments

### Animation Timing

Framer Motion animations can be adjusted:

- Stagger delays between elements
- Animation durations
- Easing curves

## Dependencies

- `@visx/axis`, `@visx/group`, `@visx/scale`, `@visx/tooltip`, `@visx/responsive`
- `@tippyjs/react`
- `framer-motion`
- `canvas-confetti`

## Performance Considerations

- **Responsive Design**: Uses `ParentSize` for dynamic sizing
- **Efficient Rendering**: Memoized calculations and event handlers
- **Lazy Loading**: Modal content only renders when open
- **Animation Optimization**: Uses transform-based animations

## Browser Support

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## Testing

The component includes:

- Unit tests for data processing functions
- Integration tests for user interactions
- Visual regression tests for chart rendering
- Accessibility tests for keyboard navigation

## Troubleshooting

### Common Issues

1. **Chart not rendering**: Check that width/height are > 0
2. **Tooltips not appearing**: Verify tooltip data structure
3. **Animations not working**: Check Framer Motion version compatibility
4. **Context menu not opening**: Ensure right-click events aren't blocked

### Debug Mode

Enable debug logging:

```typescript
// In development, enable detailed logging
const DEBUG = process.env.NODE_ENV === 'development';
```

## Future Enhancements

- Export to PDF functionality
- Custom date range filtering
- Medication adherence tracking
- Integration with electronic health records
- Collaborative annotations
- Predictive dosing suggestions 