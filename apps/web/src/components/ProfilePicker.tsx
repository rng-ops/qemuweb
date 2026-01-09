import { defaultProfiles, type VmProfile } from '@qemuweb/vm-config';

interface ProfilePickerProps {
  value: VmProfile | null;
  onChange: (profile: VmProfile | null) => void;
  disabled?: boolean;
}

export function ProfilePicker({ value, onChange, disabled }: ProfilePickerProps) {
  return (
    <div>
      <label>VM Profile</label>
      <select
        value={value?.id ?? ''}
        onChange={(e) => {
          const profile = defaultProfiles.find((p) => p.id === e.target.value);
          onChange(profile ?? null);
        }}
        className="w-full"
        disabled={disabled}
      >
        <option value="">Select a profile...</option>
        <optgroup label="x86_64">
          {defaultProfiles
            .filter((p) => p.arch === 'x86_64')
            .map((profile) => (
              <option key={profile.id} value={profile.id}>
                {profile.name}
              </option>
            ))}
        </optgroup>
        <optgroup label="aarch64">
          {defaultProfiles
            .filter((p) => p.arch === 'aarch64')
            .map((profile) => (
              <option key={profile.id} value={profile.id}>
                {profile.name}
              </option>
            ))}
        </optgroup>
      </select>
      {value && (
        <p className="text-xs text-gray-500 mt-1">{value.description}</p>
      )}
    </div>
  );
}
