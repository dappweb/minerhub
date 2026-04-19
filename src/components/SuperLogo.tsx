import markUrl from '../assets/logo/super-mark.svg';
import wordmarkUrl from '../assets/logo/super-wordmark.svg';

interface SuperLogoProps {
  variant?: 'mark' | 'wordmark';
  className?: string;
  size?: number;
}

/** SUPER brand logo. `mark` for square icon, `wordmark` for header text lockup. */
export default function SuperLogo({ variant = 'mark', className = '', size }: SuperLogoProps) {
  const src = variant === 'wordmark' ? wordmarkUrl : markUrl;
  const style = size ? { height: size, width: variant === 'wordmark' ? 'auto' : size } : undefined;
  return <img src={src} alt={variant === 'wordmark' ? 'SUPER on BNB Chain' : 'SUPER'} className={className} style={style} />;
}
