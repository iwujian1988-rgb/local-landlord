// Component stubs — we never render miniapp components in unit tests, but
// ts-jest still has to parse the imports. React.forwardRef to a no-op gives
// both a callable component and a JSX-friendly type.
import { forwardRef } from 'react';

const stub = (displayName: string) => {
  const C: any = forwardRef(() => null);
  C.displayName = displayName;
  return C;
};

export const View = stub('View');
export const Text = stub('Text');
export const ScrollView = stub('ScrollView');
export const Image = stub('Image');
export const Input = stub('Input');
export const Button = stub('Button');
export const Picker = stub('Picker');
export const Swiper = stub('Swiper');
export const SwiperItem = stub('SwiperItem');
export const Textarea = stub('Textarea');
export const Switch = stub('Switch');
export const Checkbox = stub('Checkbox');
export const CheckboxGroup = stub('CheckboxGroup');
export const Radio = stub('Radio');
export const RadioGroup = stub('RadioGroup');
export const Slider = stub('Slider');
export const Navigator = stub('Navigator');
export const WebView = stub('WebView');
export const Canvas = stub('Canvas');
export const Video = stub('Video');
