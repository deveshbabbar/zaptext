'use client';

// Restaurant info popup — shared between mobile + desktop. Triggered
// by the info icon in the mobile sage banner and by the desktop TopBar
// Info button. Shows the customer-facing facts that don't belong on
// the menu page itself: full address, hours, phone, cuisine, FSSAI /
// GST disclosure.
//
// Standalone modal shell (rather than reusing ModalShell from
// desktop-view.tsx) keeps this importable from both surfaces without
// a circular dependency. The visual treatment matches ModalShell
// exactly: dim backdrop, centred surface card, sticky title bar with
// close button, body scroll lock, Escape-to-close.

import { useEffect, type ReactNode } from 'react';
import { I, Hairline } from './atoms';

export interface InfoModalProps {
  open: boolean;
  onClose: () => void;
  businessName: string;
  tagline?: string;
  city?: string;
  address?: string;
  phone?: string;
  workingHours?: string;
  cuisineType?: string;
  deliveryRadius?: string;
  minimumOrder?: string;
  fssaiLicenseNumber?: string;
  gstin?: string;
}

export function InfoModal(props: InfoModalProps) {
  useEffect(() => {
    if (!props.open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [props.open]);

  useEffect(() => {
    if (!props.open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') props.onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [props.open, props.onClose]);

  if (!props.open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Restaurant info"
      onClick={props.onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 100,
        background: 'rgba(20,25,18,.45)',
        backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 20,
      }}
    >
      <div onClick={(e) => e.stopPropagation()} style={{
        width: '100%', maxWidth: 520,
        maxHeight: 'calc(100vh - 40px)',
        background: 'var(--zt-bg)',
        borderRadius: 18,
        overflow: 'hidden', display: 'flex', flexDirection: 'column',
        boxShadow: '0 30px 80px rgba(0,0,0,.25)',
      }}>
        <div style={{
          padding: '18px 24px', borderBottom: '0.5px solid var(--zt-border)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: 'var(--zt-surface)', flexShrink: 0,
        }}>
          <div>
            <div style={{
              fontFamily: 'var(--zt-font-display)', fontSize: 22,
              color: 'var(--zt-ink)', lineHeight: 1.1,
            }}>
              {props.businessName}
            </div>
            {props.tagline && (
              <div style={{ fontSize: 12, color: 'var(--zt-ink-muted)', marginTop: 2, fontStyle: 'italic' }}>
                {props.tagline}
              </div>
            )}
          </div>
          <button type="button" onClick={props.onClose} aria-label="Close" style={{
            width: 36, height: 36, borderRadius: 10,
            border: '0.5px solid var(--zt-border)', background: 'var(--zt-bg)',
            color: 'var(--zt-ink)', display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', padding: 0, flexShrink: 0,
          }}><I.close /></button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
          {props.workingHours && (
            <InfoRow icon={<I.clock />} label="Hours" value={props.workingHours} />
          )}
          {(props.address || props.city) && (
            <InfoRow
              icon={<I.pin />}
              label="Address"
              value={
                <>
                  {props.address && <>{props.address}<br /></>}
                  {props.city && <span style={{ color: 'var(--zt-ink-muted)' }}>{props.city}</span>}
                </>
              }
            />
          )}
          {props.phone && (
            <InfoRow
              icon={<I.phone />}
              label="Phone"
              value={
                <a href={`tel:${props.phone}`} style={{
                  color: 'var(--zt-primary-dark)',
                  textDecoration: 'none', fontWeight: 600,
                }}>{props.phone}</a>
              }
            />
          )}
          {props.cuisineType && (
            <InfoRow icon={<I.tag />} label="Cuisine" value={props.cuisineType} />
          )}
          {props.deliveryRadius && (
            <InfoRow icon={<I.scooter />} label="Delivery" value={`Within ${props.deliveryRadius}`} />
          )}
          {props.minimumOrder && (
            <InfoRow icon={<I.bag />} label="Min order" value={props.minimumOrder} />
          )}

          {(props.fssaiLicenseNumber || props.gstin) && (
            <>
              <Hairline style={{ margin: '14px 0' }} />
              <div style={{
                fontSize: 11, color: 'var(--zt-ink-muted)', lineHeight: 1.6,
                background: 'var(--zt-surface-2)', padding: '10px 12px', borderRadius: 10,
              }}>
                <div style={{
                  fontSize: 10, fontWeight: 700, letterSpacing: .6,
                  textTransform: 'uppercase', color: 'var(--zt-ink-muted)', marginBottom: 4,
                }}>
                  Compliance
                </div>
                {props.fssaiLicenseNumber && <div>FSSAI {props.fssaiLicenseNumber}</div>}
                {props.gstin && <div>GSTIN {props.gstin}</div>}
              </div>
            </>
          )}

          <div style={{
            marginTop: 18, padding: '10px 12px',
            background: '#E7F4EB', border: '0.5px solid #B6DAB8',
            borderRadius: 10, display: 'flex', gap: 8, alignItems: 'center',
          }}>
            <I.whatsapp s={{ color: '#25D366' }} />
            <div style={{ fontSize: 11, color: '#1B5E20', lineHeight: 1.4 }}>
              Order via WhatsApp anytime — say <b>menu</b> to {props.businessName}.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function InfoRow({
  icon, label, value,
}: { icon: ReactNode; label: string; value: ReactNode }) {
  return (
    <div style={{
      display: 'flex', gap: 12, padding: '10px 0',
      borderBottom: '0.5px solid var(--zt-border)',
      alignItems: 'flex-start',
    }}>
      <div style={{
        width: 30, height: 30, borderRadius: 8, flexShrink: 0,
        background: 'var(--zt-primary-soft)', color: 'var(--zt-primary-dark)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {icon}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 10.5, fontWeight: 700, color: 'var(--zt-ink-muted)',
          letterSpacing: .6, textTransform: 'uppercase', marginBottom: 2,
        }}>{label}</div>
        <div style={{ fontSize: 13.5, color: 'var(--zt-ink)', lineHeight: 1.5 }}>{value}</div>
      </div>
    </div>
  );
}
