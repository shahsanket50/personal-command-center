import React from 'react';
import { clsx } from 'clsx';

export default function Slack({ theme }) {
  return (
    <div className="max-w-2xl mx-auto px-8 py-10">
      <h1 className={clsx('text-2xl font-semibold mb-2', theme.heading)}>Slack</h1>
      <p className={clsx('text-sm', theme.subheading)}>Coming soon — Phase build in progress.</p>
    </div>
  );
}
