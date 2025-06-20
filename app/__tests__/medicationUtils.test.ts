import {
  computeTaper,
  renderMarkdownTable,
  barFill,
  getDoseChangeIcon,
  formatTooltipText
} from '../utils/medicationUtils';
import { MedicationSpan, TaperPlan } from '../lib/types';

describe('Medication Utility Functions', () => {
  describe('computeTaper', () => {
    const mockSpan: MedicationSpan = {
      medId: 'test-med-1',
      medName: 'Test Medication',
      startDate: new Date('2023-01-01'),
      doseMg: 100,
      isActive: true
    };

    it('should generate a valid taper plan with default options', () => {
      const plan = computeTaper(mockSpan);
      
      expect(plan.length).toBeGreaterThan(1);
      expect(plan[0].doseMg).toBe(100); // Current dose
      expect(plan[0].notes).toBe('Current dose');
      expect(plan[plan.length - 1].doseMg).toBe(0); // Final dose
    });

    it('should respect custom reduction percentage', () => {
      const plan = computeTaper(mockSpan, { reductionPercent: 50 });
      
      // With 50% reduction, should have fewer steps
      expect(plan.length).toBeLessThan(5);
      expect(plan[1].doseMg).toBe(50); // 50% of 100mg
    });

    it('should handle custom interval weeks', () => {
      const plan = computeTaper(mockSpan, { intervalWeeks: 1 });
      
      expect(plan[1].weekNumber).toBe(1);
      expect(plan[2].weekNumber).toBe(2);
    });

    it('should return empty array for invalid dose', () => {
      const spanWithoutDose: MedicationSpan = {
        ...mockSpan,
        doseMg: undefined
      };
      
      const plan = computeTaper(spanWithoutDose);
      expect(plan).toEqual([]);
    });

    it('should properly round doses', () => {
      const highDoseSpan: MedicationSpan = {
        ...mockSpan,
        doseMg: 87 // Should round to nearest 5mg increment
      };
      
      const plan = computeTaper(highDoseSpan);
      const secondStep = plan[1];
      
      // 87 * 0.75 = 65.25, should round to 65
      expect(secondStep.doseMg).toBe(65);
    });
  });

  describe('renderMarkdownTable', () => {
    const mockPlan: TaperPlan[] = [
      {
        date: '2023-12-01T00:00:00.000Z',
        doseMg: 100,
        weekNumber: 0,
        notes: 'Current dose'
      },
      {
        date: '2023-12-15T00:00:00.000Z',
        doseMg: 75,
        weekNumber: 2,
        notes: '25% reduction'
      }
    ];

    it('should generate proper markdown table', () => {
      const markdown = renderMarkdownTable(mockPlan);
      
      expect(markdown).toContain('| Week | Date | Dose (mg) | Notes |');
      expect(markdown).toContain('|------|------|-----------|-------|');
      expect(markdown).toContain('| 0 |');
      expect(markdown).toContain('| 100 |');
      expect(markdown).toContain('Current dose');
    });

    it('should handle empty plan', () => {
      const markdown = renderMarkdownTable([]);
      expect(markdown).toBe('No taper plan available.');
    });

    it('should format dates correctly', () => {
      const markdown = renderMarkdownTable(mockPlan);
      expect(markdown).toContain('Nov 30, 2023');
      expect(markdown).toContain('Dec 14, 2023');
    });
  });

  describe('barFill', () => {
    it('should return amber for above guideline doses', () => {
      const color = barFill(150, 100, true);
      expect(color).toBe('rgba(255,171,0,0.85)');
    });

    it('should return default blue for no dose info', () => {
      const color = barFill(undefined, undefined, false);
      expect(color).toBe('rgba(59,130,246,0.6)');
    });

    it('should calculate intensity based on dose percentage', () => {
      const lowDoseColor = barFill(25, 100, false);
      const highDoseColor = barFill(75, 100, false);
      
      // High dose should have higher opacity
      expect(highDoseColor).toContain('0.825'); // 0.3 + 0.75 * 0.7
      expect(lowDoseColor).toContain('0.475'); // 0.3 + 0.25 * 0.7
    });

    it('should cap intensity at 100%', () => {
      const color = barFill(200, 100, false); // 200% of max
      expect(color).toBe('rgba(59,130,246,1)'); // Should cap at 1.0
    });
  });

  describe('getDoseChangeIcon', () => {
    it('should return up arrow for dose increase', () => {
      const icon = getDoseChangeIcon(50, 75);
      expect(icon).toBe('▲');
    });

    it('should return down arrow for dose decrease', () => {
      const icon = getDoseChangeIcon(75, 50);
      expect(icon).toBe('▼');
    });

    it('should return circle for no change', () => {
      const icon = getDoseChangeIcon(50, 50);
      expect(icon).toBe('●');
    });

    it('should return empty string for missing doses', () => {
      expect(getDoseChangeIcon(undefined, 50)).toBe('');
      expect(getDoseChangeIcon(50, undefined)).toBe('');
      expect(getDoseChangeIcon(undefined, undefined)).toBe('');
    });
  });

  describe('formatTooltipText', () => {
    it('should format start event tooltip', () => {
      const tooltip = formatTooltipText(
        'start',
        'Sertraline',
        '2023-01-15T00:00:00.000Z',
        50,
        'Initial prescription'
      );
      
      expect(tooltip).toContain('Started Sertraline');
      expect(tooltip).toContain('50 mg');
      expect(tooltip).toContain('Jan 2023');
    });

    it('should format dose change tooltip', () => {
      const tooltip = formatTooltipText(
        'dose-change',
        'Sertraline',
        '2023-03-01T00:00:00.000Z',
        100,
        'Increased for better efficacy'
      );
      
      expect(tooltip).toContain('Changed to 100 mg');
      expect(tooltip).toContain('Feb 2023'); // Note: Date formatting adjusts for timezone
    });

    it('should format stop event tooltip', () => {
      const tooltip = formatTooltipText(
        'stop',
        'Bupropion',
        '2023-05-15T00:00:00.000Z',
        undefined,
        'Side effects'
      );
      
      expect(tooltip).toContain('Discontinued');
      expect(tooltip).toContain('May 2023');
      expect(tooltip).toContain('Side effects');
    });

    it('should include guideline warning', () => {
      const tooltip = formatTooltipText(
        'start',
        'Sertraline',
        '2023-01-15T00:00:00.000Z',
        250,
        undefined,
        true
      );
      
      expect(tooltip).toContain('⚠️ Above recommended max');
    });

    it('should include outcome information', () => {
      const tooltip = formatTooltipText(
        'start',
        'Sertraline',
        '2023-01-15T00:00:00.000Z',
        50,
        undefined,
        false,
        'PHQ-9 ↓ 55% 🎉'
      );
      
      expect(tooltip).toContain('PHQ-9 ↓ 55% 🎉');
    });
  });

  describe('Integration Tests', () => {
    it('should handle complete taper workflow', () => {
      const span: MedicationSpan = {
        medId: 'integration-test',
        medName: 'Integration Med',
        startDate: new Date('2023-01-01'),
        doseMg: 80,
        isActive: true
      };

      const plan = computeTaper(span, { reductionPercent: 25, intervalWeeks: 2 });
      const markdown = renderMarkdownTable(plan);
      
      expect(plan.length).toBeGreaterThan(1);
      expect(markdown).toContain('Integration Med');
      expect(markdown).toContain('| Week | Date | Dose (mg) | Notes |');
      
      // Verify progression
      expect(plan[0].doseMg).toBe(80);
      expect(plan[plan.length - 1].doseMg).toBe(0);
    });

    it('should handle guideline checking workflow', () => {
      const aboveGuidelineColor = barFill(250, 200, true);
      const withinGuidelineColor = barFill(150, 200, false);
      
      expect(aboveGuidelineColor).toBe('rgba(255,171,0,0.85)');
      expect(withinGuidelineColor).not.toBe('rgba(255,171,0,0.85)');
    });
  });
}); 