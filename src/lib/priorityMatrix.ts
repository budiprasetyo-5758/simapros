// Priority Matrix based on Urgency × Impact
// Reference: User-provided image matrix

export type Urgency = 'very_low' | 'low' | 'medium' | 'high';
export type Impact = 'minimal' | 'minor' | 'significant' | 'severe';
export type CalculatedPriority = 'low' | 'medium' | 'high' | 'critical';

// Matrix values from the reference image
// Rows: Urgency (Very Low, Low, Medium, High)
// Columns: Impact (Minimal, Minor, Significant, Severe)
const priorityMatrix: Record<Urgency, Record<Impact, CalculatedPriority>> = {
  very_low: {
    minimal: 'low',      // Green (empty)
    minor: 'low',        // Green (empty)
    significant: 'low',  // Yellow (3)
    severe: 'medium',    // Yellow (5)
  },
  low: {
    minimal: 'low',      // Green (empty)
    minor: 'low',        // Green (empty)
    significant: 'medium', // Yellow (4)
    severe: 'high',      // Orange (8)
  },
  medium: {
    minimal: 'low',      // Yellow (1)
    minor: 'low',        // Green (empty)
    significant: 'medium', // Yellow (6)
    severe: 'high',      // Orange (9)
  },
  high: {
    minimal: 'medium',   // Yellow (2)
    minor: 'medium',     // Yellow (7)
    significant: 'high', // Orange/Red
    severe: 'critical',  // Red (10)
  },
};

export function calculatePriority(urgency: Urgency, impact: Impact): CalculatedPriority {
  return priorityMatrix[urgency][impact];
}

export const urgencyOptions: { value: Urgency; label: string }[] = [
  { value: 'very_low', label: 'Sangat Rendah' },
  { value: 'low', label: 'Rendah' },
  { value: 'medium', label: 'Sedang' },
  { value: 'high', label: 'Tinggi' },
];

export const impactOptions: { value: Impact; label: string }[] = [
  { value: 'minimal', label: 'Minimal' },
  { value: 'minor', label: 'Minor' },
  { value: 'significant', label: 'Signifikan' },
  { value: 'severe', label: 'Kritis' },
];

export const priorityConfig: Record<CalculatedPriority, { label: string; className: string; color: string }> = {
  low: { 
    label: 'Low', 
    className: 'bg-success/10 text-success border-success/20',
    color: 'bg-success',
  },
  medium: { 
    label: 'Medium', 
    className: 'bg-warning/10 text-warning border-warning/20',
    color: 'bg-warning',
  },
  high: { 
    label: 'High', 
    className: 'bg-chart-4/10 text-chart-4 border-chart-4/20',
    color: 'bg-chart-4',
  },
  critical: { 
    label: 'Critical', 
    className: 'bg-destructive/10 text-destructive border-destructive/20',
    color: 'bg-destructive',
  },
};
