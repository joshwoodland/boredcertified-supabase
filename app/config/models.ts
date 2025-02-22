export interface ModelOption {
  label: string;
  value: string;
  description: string;
  isRecommended?: boolean;
}

export const MODEL_OPTIONS: ModelOption[] = [
  {
    label: 'GPT-4o (Latest)',
    value: 'gpt-4o',
    description: 'Latest optimized GPT-4 model',
    isRecommended: true,
  },
  {
    label: 'GPT-4o Mini',
    value: 'gpt-4o-mini',
    description: 'Lightweight version of GPT-4o, faster response times',
  }
];

export const MODEL_MAP = MODEL_OPTIONS.reduce((acc, option) => {
  acc[option.label] = option.value;
  return acc;
}, {} as Record<string, string>); 