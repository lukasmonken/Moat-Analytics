import { ratioRangeOptions, type RatioRange } from '../analytics/ratios';
import { Select } from './Fields';

export function RatioRangeSelect({
  id,
  label,
  value,
  disabled,
  onChange,
}: {
  id: string;
  label: string;
  value: RatioRange;
  disabled?: boolean;
  onChange: (value: RatioRange) => void;
}) {
  return (
    <Select
      id={id}
      label={label}
      value={value}
      disabled={disabled}
      onChange={(event) => {
        const value = event.currentTarget.value;
        const choice = ratioRangeOptions.find((option) => option.value === value);
        if (choice) onChange(choice.value);
      }}
    >
      {ratioRangeOptions.map(({ value, label }) => (
        <option key={value} value={value}>
          {label}
        </option>
      ))}
    </Select>
  );
}
