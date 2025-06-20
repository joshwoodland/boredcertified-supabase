import { useState, useEffect } from 'react';
import { 
  MedicationTimelineData, 
  MedicationEvent, 
  MedicationSummary, 
  OutcomeMarker, 
  MedGuideline,
  AppointmentDot
} from '@/app/lib/types';

// Mock data for demonstration - Test fixtures for relative dose scaling
const generateMockData = (patientId: string): MedicationTimelineData => {
  const events: MedicationEvent[] = [
    // Sertraline events (start:25, max:200)
    {
      medId: 'sertraline-1',
      medName: 'Sertraline',
      date: '2025-01-23T00:00:00.000Z',
      type: 'start',
      doseMg: 25,
      note: 'Starting dose'
    },
    {
      medId: 'sertraline-1',
      medName: 'Sertraline',
      date: '2025-01-24T00:00:00.000Z',
      type: 'dose-change',
      doseMg: 50,
      note: 'Dose increase'
    },
    {
      medId: 'sertraline-1',
      medName: 'Sertraline',
      date: '2025-01-25T00:00:00.000Z',
      type: 'dose-change',
      doseMg: 125,
      note: 'Further increase'
    },
    // Lithium events (start:300, max:1500)
    {
      medId: 'lithium-1',
      medName: 'Lithium',
      date: '2025-01-23T00:00:00.000Z',
      type: 'start',
      doseMg: 300,
      note: 'Starting dose'
    },
    {
      medId: 'lithium-1',
      medName: 'Lithium',
      date: '2025-01-24T00:00:00.000Z',
      type: 'dose-change',
      doseMg: 600,
      note: 'Dose increase'
    },
    // Bupropion events (start:150, max:450)
    {
      medId: 'bupropion-1',
      medName: 'Bupropion',
      date: '2025-01-23T00:00:00.000Z',
      type: 'start',
      doseMg: 150,
      note: 'Starting dose'
    }
  ];

  const summaries: MedicationSummary[] = [
    {
      medId: 'sertraline-1',
      medName: 'Sertraline',
      isActive: true,
      lastDoseMg: 125,
      lastChangeDate: '2025-01-25T00:00:00.000Z'
    },
    {
      medId: 'lithium-1',
      medName: 'Lithium',
      isActive: true,
      lastDoseMg: 600,
      lastChangeDate: '2025-01-24T00:00:00.000Z'
    },
    {
      medId: 'bupropion-1',
      medName: 'Bupropion',
      isActive: true,
      lastDoseMg: 150,
      lastChangeDate: '2025-01-23T00:00:00.000Z'
    }
  ];

  const outcomeMarkers: OutcomeMarker[] = [
    {
      medId: 'sertraline-1',
      date: '2025-01-24T00:00:00.000Z',
      scale: 'PHQ-9',
      score: 8,
      percentChange: -55
    },
    {
      medId: 'lithium-1',
      date: '2025-01-24T00:00:00.000Z',
      scale: 'GAD-7',
      score: 6,
      percentChange: -50
    }
  ];

  const guidelines: MedGuideline[] = [
    {
      medName: 'Sertraline',
      recommendedMaxMg: 200
    },
    {
      medName: 'Lithium',
      recommendedMaxMg: 1500
    },
    {
      medName: 'Bupropion',
      recommendedMaxMg: 450
    }
  ];

  // Generate appointment dots for test fixtures
  const appointmentDots: AppointmentDot[] = [
    {
      medId: 'sertraline-1',
      medName: 'Sertraline',
      date: '2025-01-24T12:00:00.000Z',
      doseMg: 50,
      appointmentType: 'follow-up'
    },
    {
      medId: 'lithium-1',
      medName: 'Lithium',
      date: '2025-01-24T10:00:00.000Z',
      doseMg: 600,
      appointmentType: 'check-in'
    },
    {
      medId: 'bupropion-1',
      medName: 'Bupropion',
      date: '2025-01-23T14:00:00.000Z',
      doseMg: 150,
      appointmentType: 'initial'
    }
  ];

  return {
    events,
    summaries,
    outcomeMarkers,
    guidelines,
    appointmentDots
  };
};

export function useMedicationTimeline(patientId: string) {
  const [data, setData] = useState<MedicationTimelineData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        // Simulate API call delay
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // In a real implementation, this would be:
        // const response = await fetch(`/api/patients/${patientId}/medication-timeline`);
        // if (!response.ok) throw new Error('Failed to fetch medication timeline');
        // const data = await response.json();
        
        const mockData = generateMockData(patientId);
        setData(mockData);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch medication timeline');
      } finally {
        setIsLoading(false);
      }
    };

    if (patientId) {
      fetchData();
    }
  }, [patientId]);

  return {
    data,
    isLoading,
    error,
    refetch: () => {
      if (patientId) {
        const mockData = generateMockData(patientId);
        setData(mockData);
      }
    }
  };
} 