import AvatarPresetEnhancer from './AvatarPresetEnhancer';

export default function SettingsLayout({ children }) {
  return (
    <>
      <AvatarPresetEnhancer />
      {children}
    </>
  );
}
