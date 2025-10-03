import { render, screen } from '@testing-library/react';
import App from './App';

test('renders Pehsai spin button', () => {
  render(<App />);
  const spinButton = screen.getByRole('button', { name: /spin/i });
  expect(spinButton).toBeInTheDocument();
});
