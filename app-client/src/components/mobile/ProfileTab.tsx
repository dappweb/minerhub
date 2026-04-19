import React from 'react';
import { Linking, Modal, Pressable, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { exportWalletPrivateKey } from '../../services/wallet';
import { copyToClipboard } from '../../utils/clipboard';
import s from './sharedStyles';

export interface SupportContactItem {
  id: string;
  type: string;
  label: string;
  value: string;
  note: string;
}

export interface ProfileTabProps {
  walletAddress: string;
  expireDate: string;
  contractExpired: boolean;
  transferTo: string;
  setTransferTo: (v: string) => void;
  transferAmount: string;
  setTransferAmount: (v: string) => void;
  isBusy: boolean;
  identityReady: boolean;
  transferNativeToken: () => void;
  onCopyAddress: () => void;
  copyState: 'idle' | 'copied' | 'failed';
  supportContacts?: SupportContactItem[];
  t: {
    profileSummary: string;
    walletCardTitle: string;
    notInit: string;
    profileExpire: string;
    contractExpiredTitle: string;
    contractExpiredBody: string;
    advancedSettings: string;
    transferTitle: string;
    transferTo: string;
    transferAmount: string;
    sendTransfer: string;
    copyAddress: string;
    copied: string;
    copyFailed: string;
    supportContactsTitle: string;
    supportContactsEmpty: string;
    exportPrivateKeyTitle: string;
    exportPrivateKeyButton: string;
    exportPrivateKeyWarning: string;
    exportPrivateKeyReveal: string;
    exportPrivateKeyCopy: string;
    exportPrivateKeyClose: string;
    exportPrivateKeyCopied: string;
    exportPrivateKeyMissing: string;
  };
}

const CONTACT_TYPE_LABELS: Record<string, string> = {
  weixin: 'WeChat',
  telegram: 'Telegram',
  email: 'Email',
  qq: 'QQ',
  phone: 'Phone',
  whatsapp: 'WhatsApp',
  line: 'LINE',
  url: 'URL',
  other: 'Other',
};

function getContactTypeLabel(type: string): string {
  return CONTACT_TYPE_LABELS[type] || type.toUpperCase();
}

function getContactLink(type: string, value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  switch (type) {
    case 'email':
      return `mailto:${trimmed}`;
    case 'phone':
      return `tel:${trimmed.replace(/\s+/g, '')}`;
    case 'whatsapp':
      return `https://wa.me/${trimmed.replace(/[^0-9]/g, '')}`;
    case 'telegram': {
      if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed;
      const handle = trimmed.replace(/^@/, '');
      return `https://t.me/${handle}`;
    }
    case 'url':
      if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed;
      return `https://${trimmed}`;
    default:
      return null;
  }
}

export default function ProfileTab({
  walletAddress,
  expireDate,
  contractExpired,
  transferTo,
  setTransferTo,
  transferAmount,
  setTransferAmount,
  isBusy,
  identityReady,
  transferNativeToken,
  onCopyAddress,
  copyState,
  supportContacts,
  t,
}: ProfileTabProps) {
  const copyLabel =
    copyState === 'copied' ? t.copied : copyState === 'failed' ? t.copyFailed : t.copyAddress;
  const contacts = (supportContacts ?? []).filter((item) => item.value && item.value.trim().length > 0);

  const [exportVisible, setExportVisible] = React.useState(false);
  const [exportedKey, setExportedKey] = React.useState<string | null>(null);
  const [exportRevealing, setExportRevealing] = React.useState(false);
  const [exportCopied, setExportCopied] = React.useState(false);
  const [exportError, setExportError] = React.useState('');

  const handleOpenExport = () => {
    setExportedKey(null);
    setExportCopied(false);
    setExportError('');
    setExportVisible(true);
  };

  const handleCloseExport = () => {
    setExportVisible(false);
    setExportedKey(null);
    setExportCopied(false);
    setExportError('');
  };

  const handleRevealExport = async () => {
    try {
      setExportRevealing(true);
      setExportError('');
      const key = await exportWalletPrivateKey();
      if (!key) {
        setExportError(t.exportPrivateKeyMissing);
        return;
      }
      setExportedKey(key);
    } catch (error) {
      setExportError(error instanceof Error ? error.message : String(error));
    } finally {
      setExportRevealing(false);
    }
  };

  const handleCopyExport = async () => {
    if (!exportedKey) return;
    const ok = await copyToClipboard(exportedKey);
    setExportCopied(ok);
    setTimeout(() => setExportCopied(false), 1800);
  };
  return (
    <>
      <View style={s.actionCard}>
        <Text style={s.sectionTitle}>{t.profileSummary}</Text>
        <Text style={s.metricLabel}>{t.walletCardTitle}</Text>
        <Text style={s.walletText}>{walletAddress || t.notInit}</Text>
        <TouchableOpacity
          onPress={onCopyAddress}
          disabled={!walletAddress}
          style={[styles.copyBtn, !walletAddress && s.disabledBtn, copyState === 'copied' && styles.copyBtnOk]}
        >
          <Text style={styles.copyBtnText}>{copyLabel}</Text>
        </TouchableOpacity>
        <Text style={s.profileExpire}>{t.profileExpire}: {expireDate}</Text>
        {contractExpired && (
          <View style={styles.expiredBanner}>
            <Text style={styles.expiredBannerTitle}>{t.contractExpiredTitle}</Text>
            <Text style={styles.expiredBannerBody}>{t.contractExpiredBody}</Text>
          </View>
        )}
      </View>

      <View style={s.actionCard}>
        <Text style={s.sectionTitle}>{t.supportContactsTitle}</Text>
        {contacts.length === 0 ? (
          <Text style={styles.contactEmpty}>{t.supportContactsEmpty}</Text>
        ) : (
          contacts.map((contact) => {
            const link = getContactLink(contact.type, contact.value);
            const title = contact.label?.trim() || getContactTypeLabel(contact.type);
            const handlePress = () => {
              if (link) {
                Linking.openURL(link).catch(() => undefined);
              }
            };
            return (
              <TouchableOpacity
                key={contact.id}
                activeOpacity={link ? 0.7 : 1}
                onPress={link ? handlePress : undefined}
                style={styles.contactRow}
              >
                <View style={styles.contactTypeTag}>
                  <Text style={styles.contactTypeTagText}>{getContactTypeLabel(contact.type)}</Text>
                </View>
                <View style={styles.contactBody}>
                  <Text style={styles.contactTitle}>{title}</Text>
                  <Text style={styles.contactValue}>{contact.value}</Text>
                  {contact.note ? <Text style={styles.contactNote}>{contact.note}</Text> : null}
                </View>
              </TouchableOpacity>
            );
          })
        )}
      </View>

      <View style={s.actionCard}>
        <Text style={s.sectionTitle}>{t.advancedSettings}</Text>
        <Text style={s.label}>{t.transferTitle}</Text>
        <TextInput
          style={s.input}
          value={transferTo}
          onChangeText={setTransferTo}
          placeholder={t.transferTo}
          placeholderTextColor="#93a9d1"
          autoCapitalize="none"
          autoCorrect={false}
          editable={!isBusy}
        />
        <TextInput
          style={s.input}
          value={transferAmount}
          onChangeText={setTransferAmount}
          keyboardType="decimal-pad"
          placeholder={t.transferAmount}
          placeholderTextColor="#93a9d1"
          editable={!isBusy}
        />
        <TouchableOpacity style={s.secondaryBtn} onPress={transferNativeToken} disabled={isBusy || !identityReady}>
          <Text style={s.secondaryBtnText}>{t.sendTransfer}</Text>
        </TouchableOpacity>

        <View style={styles.exportDivider} />
        <Text style={s.label}>{t.exportPrivateKeyTitle}</Text>
        <Text style={styles.exportWarn}>{t.exportPrivateKeyWarning}</Text>
        <TouchableOpacity
          style={styles.exportBtn}
          onPress={handleOpenExport}
          disabled={!identityReady}
        >
          <Text style={styles.exportBtnText}>{t.exportPrivateKeyButton}</Text>
        </TouchableOpacity>
      </View>

      <Modal
        visible={exportVisible}
        transparent
        animationType="fade"
        onRequestClose={handleCloseExport}
      >
        <Pressable style={styles.modalMask} onPress={handleCloseExport}>
          <Pressable style={styles.modalCard}>
            <Text style={styles.modalTitle}>{t.exportPrivateKeyTitle}</Text>
            <Text style={styles.modalWarn}>{t.exportPrivateKeyWarning}</Text>

            {exportedKey ? (
              <>
                <View style={styles.keyBox}>
                  <Text selectable style={styles.keyText}>{exportedKey}</Text>
                </View>
                <TouchableOpacity
                  style={[styles.modalPrimaryBtn, exportCopied && styles.modalPrimaryBtnOk]}
                  onPress={handleCopyExport}
                >
                  <Text style={styles.modalPrimaryBtnText}>
                    {exportCopied ? t.exportPrivateKeyCopied : t.exportPrivateKeyCopy}
                  </Text>
                </TouchableOpacity>
              </>
            ) : (
              <TouchableOpacity
                style={[styles.modalPrimaryBtn, exportRevealing && styles.modalPrimaryBtnDisabled]}
                onPress={handleRevealExport}
                disabled={exportRevealing}
              >
                <Text style={styles.modalPrimaryBtnText}>{t.exportPrivateKeyReveal}</Text>
              </TouchableOpacity>
            )}

            {!!exportError && <Text style={styles.modalError}>{exportError}</Text>}

            <TouchableOpacity style={styles.modalGhostBtn} onPress={handleCloseExport}>
              <Text style={styles.modalGhostBtnText}>{t.exportPrivateKeyClose}</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  expiredBanner: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#7f1d1d',
    backgroundColor: '#3f0d17',
    padding: 10,
    gap: 4,
    marginTop: 6,
  },
  expiredBannerTitle: {
    color: '#ffe4e6',
    fontSize: 13,
    fontWeight: '800',
  },
  expiredBannerBody: {
    color: '#fecdd3',
    fontSize: 12,
    lineHeight: 18,
  },
  copyBtn: {
    alignSelf: 'flex-start',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#1f4f96',
    borderWidth: 1,
    borderColor: '#3f77bc',
  },
  copyBtnOk: {
    backgroundColor: '#0f766e',
    borderColor: '#14b8a6',
  },
  copyBtnText: {
    color: '#e8fbff',
    fontSize: 13,
    fontWeight: '700',
  },
  contactEmpty: {
    color: '#93a9d1',
    fontSize: 12,
    lineHeight: 18,
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1f3b69',
    backgroundColor: '#0f213f',
    marginTop: 8,
  },
  contactTypeTag: {
    minWidth: 68,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: '#1f4f96',
    borderWidth: 1,
    borderColor: '#3f77bc',
    alignItems: 'center',
  },
  contactTypeTagText: {
    color: '#e8fbff',
    fontSize: 11,
    fontWeight: '800',
  },
  contactBody: {
    flex: 1,
    gap: 2,
  },
  contactTitle: {
    color: '#e8fbff',
    fontSize: 13,
    fontWeight: '700',
  },
  contactValue: {
    color: '#7dd3fc',
    fontSize: 13,
  },
  contactNote: {
    color: '#93a9d1',
    fontSize: 11,
  },
  exportDivider: {
    height: 1,
    backgroundColor: '#1f3b69',
    marginVertical: 12,
  },
  exportWarn: {
    color: '#fca5a5',
    fontSize: 11,
    lineHeight: 16,
    marginBottom: 8,
  },
  exportBtn: {
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: '#3f1d1d',
    borderWidth: 1,
    borderColor: '#b91c1c',
    alignItems: 'center',
  },
  exportBtnText: {
    color: '#fecaca',
    fontSize: 13,
    fontWeight: '800',
  },
  modalMask: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.72)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 16,
    padding: 18,
    backgroundColor: '#0b1a33',
    borderWidth: 1,
    borderColor: '#1f3b69',
    gap: 10,
  },
  modalTitle: {
    color: '#e8fbff',
    fontSize: 16,
    fontWeight: '800',
  },
  modalWarn: {
    color: '#fca5a5',
    fontSize: 12,
    lineHeight: 18,
  },
  keyBox: {
    borderRadius: 10,
    backgroundColor: '#0f213f',
    borderWidth: 1,
    borderColor: '#1f3b69',
    padding: 10,
  },
  keyText: {
    color: '#7dd3fc',
    fontSize: 12,
    fontFamily: 'Courier',
  },
  modalPrimaryBtn: {
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    backgroundColor: '#1f4f96',
    borderWidth: 1,
    borderColor: '#3f77bc',
  },
  modalPrimaryBtnOk: {
    backgroundColor: '#0f766e',
    borderColor: '#14b8a6',
  },
  modalPrimaryBtnDisabled: {
    opacity: 0.6,
  },
  modalPrimaryBtnText: {
    color: '#e8fbff',
    fontSize: 13,
    fontWeight: '800',
  },
  modalGhostBtn: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  modalGhostBtnText: {
    color: '#93a9d1',
    fontSize: 12,
    fontWeight: '700',
  },
  modalError: {
    color: '#fca5a5',
    fontSize: 12,
  },
});
