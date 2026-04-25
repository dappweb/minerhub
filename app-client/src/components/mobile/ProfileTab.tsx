import React from 'react';
import { Linking, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
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
  machineCode: string;
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
  bnbBalance: string;
  superBalance: string;
  usdtBalance: string;
  onExportWallet: () => void;
  onImportWalletClick: () => void;
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
    checkUpdateTitle?: string;
    checkUpdateButton?: string;
    checkUpdateHint?: string;
    appVersionLabel?: string;
    inviterTitle?: string;
    inviterWallet?: string;
    inviterEmpty?: string;
    referralTitle?: string;
    referralDirectCount?: string;
    referralDirectAmount?: string;
    referralTeamCount?: string;
    referralTeamAmount?: string;
    referralMembersTitle?: string;
    referralMembersDirectTab?: string;
    referralMembersTeamTab?: string;
    referralMembersLevel?: string;
    referralMembersReward?: string;
    referralMembersJoined?: string;
    referralMembersContract?: string;
    referralMembersContractActive?: string;
    referralMembersContractInactive?: string;
    referralMembersEmpty?: string;
    referralMembersLoading?: string;
    referralMembersError?: string;
    referralMembersPage?: string;
    referralMembersPrev?: string;
    referralMembersNext?: string;
    agreementSectionLabel?: string;
    agreementStatusAccepted?: string;
    agreementStatusPending?: string;
    agreementViewButton?: string;
    agreementTitleFallback?: string;
    agreementIntro?: string;
    agreementAccept?: string;
    agreementSubmitting?: string;
    agreementFailed?: string;
    agreementCloseButton?: string;
  };
  appVersion?: string;
  onCheckUpdate?: () => void;
  inviterInfo?: {
    userId: string;
    wallet: string | null;
  } | null;
  referralSummary?: {
    directCount: number;
    directAmountUsdt: string;
    teamCount: number;
    teamAmountUsdt: string;
  } | null;
  referralMembers?: Array<{
    userId: string;
    wallet: string;
    nickname: string | null;
    level: number;
    totalRewardUsdt: string;
    contractActive: number;
    createdAt: string;
  }>;
  referralMembersMode?: 'direct' | 'team';
  referralMembersTotal?: number;
  referralMembersPage?: number;
  referralMembersPageSize?: number;
  referralMembersLoading?: boolean;
  referralMembersError?: string;
  onReferralModeChange?: (mode: 'direct' | 'team') => void;
  onReferralPageChange?: (page: number) => void;
  agreement?: {
    required: boolean;
    accepted: boolean;
    version: string | null;
    title: string;
    content: string;
    submitting: boolean;
    error: string;
    onAccept: () => void;
  } | null;
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
  machineCode,
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
  bnbBalance,
  superBalance,
  usdtBalance,
  onExportWallet,
  onImportWalletClick,
  t,
  appVersion,
  onCheckUpdate,
  inviterInfo,
  referralSummary,
  referralMembers,
  referralMembersMode = 'direct',
  referralMembersTotal = 0,
  referralMembersPage = 1,
  referralMembersPageSize = 20,
  referralMembersLoading = false,
  referralMembersError = '',
  onReferralModeChange,
  onReferralPageChange,
  agreement,
}: ProfileTabProps) {
  const isZh = t.sendTransfer !== 'Send Transfer';
  const copyLabel =
    copyState === 'copied' ? t.copied : copyState === 'failed' ? t.copyFailed : t.copyAddress;
  const contacts = (supportContacts ?? []).filter((item) => item.value && item.value.trim().length > 0);

  const [exportVisible, setExportVisible] = React.useState(false);
  const [exportedKey, setExportedKey] = React.useState<string | null>(null);
  const [exportRevealing, setExportRevealing] = React.useState(false);
  const [exportCopied, setExportCopied] = React.useState(false);
  const [exportError, setExportError] = React.useState('');
  const [advancedOpen, setAdvancedOpen] = React.useState(false);
  const members = referralMembers ?? [];
  const totalPages = Math.max(1, Math.ceil(referralMembersTotal / Math.max(1, referralMembersPageSize)));
  const [supportCopied, setSupportCopied] = React.useState<'idle' | 'wallet' | 'machine'>('idle');
  const [agreementVisible, setAgreementVisible] = React.useState(false);

  const agreementSectionLabel = t.agreementSectionLabel ?? (isZh ? '用户协议' : 'User Agreement');
  const agreementStatusAccepted = t.agreementStatusAccepted ?? (isZh ? '已同意' : 'Accepted');
  const agreementStatusPending = t.agreementStatusPending ?? (isZh ? '待同意' : 'Pending');
  const agreementViewButton = t.agreementViewButton ?? (isZh ? '查看 / 同意' : 'View / Accept');
  const agreementTitleFallback = t.agreementTitleFallback ?? (isZh ? '用户协议' : 'User Agreement');
  const agreementIntro = t.agreementIntro ?? (isZh ? '请阅读并同意以下协议。' : 'Please read and accept the agreement.');
  const agreementAcceptLabel = t.agreementAccept ?? (isZh ? '我已阅读并同意' : 'I have read and agree');
  const agreementSubmittingLabel = t.agreementSubmitting ?? (isZh ? '提交中...' : 'Submitting...');
  const agreementCloseLabel = t.agreementCloseButton ?? (isZh ? '关闭' : 'Close');

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

  const handleCopyInviteWallet = async () => {
    if (!walletAddress) return;
    const ok = await copyToClipboard(walletAddress);
    if (ok) {
      setSupportCopied('wallet');
      setTimeout(() => setSupportCopied('idle'), 1800);
    }
  };

  const handleCopyMachineCode = async () => {
    if (!machineCode) return;
    const ok = await copyToClipboard(machineCode);
    if (ok) {
      setSupportCopied('machine');
      setTimeout(() => setSupportCopied('idle'), 1800);
    }
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

        {agreement?.required && (
          <View style={styles.agreementRow}>
            <View style={styles.agreementRowText}>
              <Text style={styles.agreementRowLabel}>{agreementSectionLabel}</Text>
              <Text style={[styles.agreementRowStatus, agreement.accepted ? styles.agreementRowStatusOk : styles.agreementRowStatusPending]}>
                {agreement.accepted ? `${agreementStatusAccepted}${agreement.version ? ` v${agreement.version}` : ''}` : agreementStatusPending}
              </Text>
            </View>
            <TouchableOpacity
              style={[styles.agreementRowBtn, agreement.accepted && styles.agreementRowBtnGhost]}
              onPress={() => setAgreementVisible(true)}
            >
              <Text style={styles.agreementRowBtnText}>{agreementViewButton}</Text>
            </TouchableOpacity>
          </View>
        )}
        
        {/* Wallet Balances */}
        {walletAddress && (
          <View style={styles.balanceSection}>
            <View style={styles.balanceRow}>
              <Text style={styles.balanceLabel}>BNB</Text>
              <Text style={styles.balanceValue}>{bnbBalance}</Text>
            </View>
            <View style={styles.balanceRow}>
              <Text style={styles.balanceLabel}>SUPER</Text>
              <Text style={styles.balanceValue}>{superBalance}</Text>
            </View>
            <View style={styles.balanceRow}>
              <Text style={styles.balanceLabel}>USDT</Text>
              <Text style={styles.balanceValue}>{usdtBalance}</Text>
            </View>
          </View>
        )}
        
        {contractExpired && (
          <View style={styles.expiredBanner}>
            <Text style={styles.expiredBannerTitle}>{t.contractExpiredTitle}</Text>
            <Text style={styles.expiredBannerBody}>{t.contractExpiredBody}</Text>
          </View>
        )}
      </View>

      <View style={s.actionCard}>
        <Text style={s.sectionTitle}>{t.supportContactsTitle}</Text>
        <View style={styles.growthCard}>
          <Text style={styles.growthTitle}>{isZh ? '邀请与开通怎么配合' : 'How invite and activation work together'}</Text>
          <Text style={styles.growthText}>
            {isZh
              ? '复制你的邀请钱包给新用户，让对方注册时填写；设备开通前，再把机器码提交给客服完成绑定。'
              : 'Share your invite wallet with new users during signup, then submit the device machine code to support for activation.'}
          </Text>
        </View>
        <View style={styles.supportToolsGrid}>
          <View style={styles.supportToolCard}>
            <Text style={styles.supportToolLabel}>{isZh ? '我的邀请钱包' : 'My invite wallet'}</Text>
            <Text style={styles.supportToolValue}>{walletAddress || t.notInit}</Text>
            <TouchableOpacity style={styles.supportToolBtn} onPress={handleCopyInviteWallet} disabled={!walletAddress}>
              <Text style={styles.supportToolBtnText}>
                {supportCopied === 'wallet' ? t.copied : (t.copyAddress ?? 'Copy')}
              </Text>
            </TouchableOpacity>
          </View>
          <View style={styles.supportToolCard}>
            <Text style={styles.supportToolLabel}>{isZh ? '设备机器码' : 'Device machine code'}</Text>
            <Text style={styles.supportToolValue}>{machineCode || '--'}</Text>
            <TouchableOpacity style={styles.supportToolBtn} onPress={handleCopyMachineCode} disabled={!machineCode}>
              <Text style={styles.supportToolBtnText}>
                {supportCopied === 'machine' ? t.copied : (t.copyAddress ?? 'Copy')}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
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
        <Text style={s.sectionTitle}>{t.inviterTitle ?? 'My Inviter'}</Text>
        <Text style={styles.referralLabel}>{t.inviterWallet ?? 'Inviter Wallet'}</Text>
        <Text style={styles.inviterValueText}>
          {inviterInfo?.wallet?.trim() || inviterInfo?.userId || t.inviterEmpty || 'No inviter bound yet'}
        </Text>
      </View>

      {referralSummary && (
        <View style={s.actionCard}>
          <Text style={s.sectionTitle}>{t.referralTitle ?? 'Referral Summary'}</Text>
          <View style={styles.referralGrid}>
            <View style={styles.referralItem}>
              <Text style={styles.referralLabel}>{t.referralDirectCount ?? 'Direct Accounts'}</Text>
              <Text style={styles.referralValue}>{referralSummary.directCount}</Text>
            </View>
            <View style={styles.referralItem}>
              <Text style={styles.referralLabel}>{t.referralDirectAmount ?? 'Direct Amount (USDT)'}</Text>
              <Text style={styles.referralValue}>{referralSummary.directAmountUsdt}</Text>
            </View>
            <View style={styles.referralItem}>
              <Text style={styles.referralLabel}>{t.referralTeamCount ?? 'Team Accounts'}</Text>
              <Text style={styles.referralValue}>{referralSummary.teamCount}</Text>
            </View>
            <View style={styles.referralItem}>
              <Text style={styles.referralLabel}>{t.referralTeamAmount ?? 'Team Amount (USDT)'}</Text>
              <Text style={styles.referralValue}>{referralSummary.teamAmountUsdt}</Text>
            </View>
          </View>
        </View>
      )}

      <View style={s.actionCard}>
        <Text style={s.sectionTitle}>{t.referralMembersTitle ?? 'Team Members'}</Text>
        <View style={styles.memberTabRow}>
          <TouchableOpacity
            style={[styles.memberTabBtn, referralMembersMode === 'direct' && styles.memberTabBtnActive]}
            onPress={() => onReferralModeChange?.('direct')}
          >
            <Text style={styles.memberTabText}>{t.referralMembersDirectTab ?? 'Direct'}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.memberTabBtn, referralMembersMode === 'team' && styles.memberTabBtnActive]}
            onPress={() => onReferralModeChange?.('team')}
          >
            <Text style={styles.memberTabText}>{t.referralMembersTeamTab ?? 'Team'}</Text>
          </TouchableOpacity>
        </View>

        {referralMembersLoading ? (
          <Text style={styles.contactEmpty}>{t.referralMembersLoading ?? 'Loading...'}</Text>
        ) : referralMembersError ? (
          <Text style={styles.memberErrorText}>{referralMembersError}</Text>
        ) : members.length === 0 ? (
          <Text style={styles.contactEmpty}>{t.referralMembersEmpty ?? 'No members yet'}</Text>
        ) : (
          <View style={styles.memberListWrap}>
            {members.map((item) => (
              <View key={`${item.userId}-${item.level}`} style={styles.memberItem}>
                <View style={styles.memberItemHeader}>
                  <Text style={styles.memberNameText}>{item.nickname?.trim() || item.wallet.slice(0, 10) + '...' + item.wallet.slice(-6)}</Text>
                  <Text style={styles.memberLevelText}>{t.referralMembersLevel ?? 'Level'} {item.level}</Text>
                </View>
                <Text style={styles.memberWalletText}>{item.wallet}</Text>
                <View style={styles.memberMetaRow}>
                  <Text style={styles.memberMetaText}>{t.referralMembersReward ?? 'Reward'}: {item.totalRewardUsdt} USDT</Text>
                  <Text style={styles.memberMetaText}>
                    {t.referralMembersContract ?? 'Contract'}: {item.contractActive ? (t.referralMembersContractActive ?? 'Active') : (t.referralMembersContractInactive ?? 'Inactive')}
                  </Text>
                </View>
                <Text style={styles.memberJoinedText}>{t.referralMembersJoined ?? 'Joined'}: {new Date(item.createdAt).toLocaleDateString('zh-CN')}</Text>
              </View>
            ))}
          </View>
        )}

        <View style={styles.memberPagerRow}>
          <TouchableOpacity
            style={[styles.memberPagerBtn, referralMembersPage <= 1 && s.disabledBtn]}
            onPress={() => onReferralPageChange?.(Math.max(1, referralMembersPage - 1))}
            disabled={referralMembersPage <= 1}
          >
            <Text style={styles.memberPagerText}>{t.referralMembersPrev ?? 'Prev'}</Text>
          </TouchableOpacity>
          <Text style={styles.memberPagerInfo}>{t.referralMembersPage ?? 'Page'} {referralMembersPage}/{totalPages}</Text>
          <TouchableOpacity
            style={[styles.memberPagerBtn, referralMembersPage >= totalPages && s.disabledBtn]}
            onPress={() => onReferralPageChange?.(Math.min(totalPages, referralMembersPage + 1))}
            disabled={referralMembersPage >= totalPages}
          >
            <Text style={styles.memberPagerText}>{t.referralMembersNext ?? 'Next'}</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={s.actionCard}>
        <TouchableOpacity style={styles.collapseHeaderBtn} onPress={() => setAdvancedOpen((prev) => !prev)}>
          <Text style={styles.collapseHeaderTitle}>{t.advancedSettings}</Text>
          <Text style={styles.collapseHeaderHint}>{advancedOpen ? (isZh ? '收起' : 'Hide') : (isZh ? '展开' : 'Show')}</Text>
        </TouchableOpacity>

        {advancedOpen && (
          <>
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
            <View style={styles.walletActionsRow}>
              <TouchableOpacity style={styles.walletActionBtn} onPress={onImportWalletClick} disabled={!identityReady}>
                <Text style={styles.walletActionBtnText}>{isZh ? '导入钱包' : 'Import Wallet'}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.walletActionBtn}
                onPress={handleOpenExport}
                disabled={!identityReady}
              >
                <Text style={styles.walletActionBtnText}>{t.exportPrivateKeyButton}</Text>
              </TouchableOpacity>
            </View>

            {onCheckUpdate && (
              <>
                <View style={styles.exportDivider} />
                <Text style={s.label}>{t.checkUpdateTitle ?? '应用更新'}</Text>
                {t.checkUpdateHint && <Text style={styles.exportWarn}>{t.checkUpdateHint}</Text>}
                <TouchableOpacity style={styles.exportBtn} onPress={onCheckUpdate}>
                  <Text style={styles.exportBtnText}>{t.checkUpdateButton ?? '检查更新'}</Text>
                </TouchableOpacity>
                {appVersion && (
                  <Text style={styles.versionText}>
                    {(t.appVersionLabel ?? '当前版本')}: {appVersion}
                  </Text>
                )}
              </>
            )}
          </>
        )}
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

      {agreement && (
        <Modal
          visible={agreementVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setAgreementVisible(false)}
        >
          <Pressable style={styles.modalMask} onPress={() => setAgreementVisible(false)}>
            <Pressable style={styles.modalCardLarge}>
              <Text style={styles.modalTitle}>
                {agreement.title || agreementTitleFallback}
                {agreement.version ? `  v${agreement.version}` : ''}
              </Text>
              <Text style={styles.modalWarn}>{agreementIntro}</Text>
              <ScrollView style={styles.agreementScroll} contentContainerStyle={styles.agreementScrollContent}>
                <Text style={styles.agreementBody}>{agreement.content}</Text>
              </ScrollView>
              {!!agreement.error && <Text style={styles.modalError}>{agreement.error}</Text>}
              {agreement.accepted ? (
                <TouchableOpacity style={styles.modalGhostBtn} onPress={() => setAgreementVisible(false)}>
                  <Text style={styles.modalGhostBtnText}>{agreementCloseLabel}</Text>
                </TouchableOpacity>
              ) : (
                <>
                  <TouchableOpacity
                    style={[styles.modalPrimaryBtn, agreement.submitting && styles.modalPrimaryBtnDisabled]}
                    onPress={() => { agreement.onAccept(); }}
                    disabled={agreement.submitting}
                  >
                    <Text style={styles.modalPrimaryBtnText}>
                      {agreement.submitting ? agreementSubmittingLabel : agreementAcceptLabel}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.modalGhostBtn} onPress={() => setAgreementVisible(false)}>
                    <Text style={styles.modalGhostBtnText}>{agreementCloseLabel}</Text>
                  </TouchableOpacity>
                </>
              )}
            </Pressable>
          </Pressable>
        </Modal>
      )}
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
  growthCard: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#225b98',
    backgroundColor: '#082754',
    padding: 12,
    gap: 6,
  },
  growthTitle: {
    color: '#e8fbff',
    fontSize: 13,
    fontWeight: '800',
  },
  growthText: {
    color: '#b8dcff',
    fontSize: 12,
    lineHeight: 18,
  },
  supportToolsGrid: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
    marginBottom: 4,
  },
  supportToolCard: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1f3b69',
    backgroundColor: '#0f213f',
    padding: 10,
    gap: 6,
  },
  supportToolLabel: {
    color: '#93a9d1',
    fontSize: 11,
  },
  supportToolValue: {
    color: '#e8fbff',
    fontSize: 13,
    fontWeight: '700',
  },
  supportToolBtn: {
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: 'center',
    backgroundColor: '#1f4f96',
    borderWidth: 1,
    borderColor: '#3f77bc',
  },
  supportToolBtnText: {
    color: '#e8fbff',
    fontSize: 12,
    fontWeight: '700',
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
  referralGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 8,
  },
  referralItem: {
    width: '48%',
    backgroundColor: '#0f213f',
    borderColor: '#1f3b69',
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 10,
  },
  referralLabel: {
    color: '#93a9d1',
    fontSize: 12,
  },
  referralValue: {
    color: '#e2e8f0',
    fontSize: 16,
    fontWeight: '700',
    marginTop: 6,
  },
  inviterValueText: {
    color: '#e2e8f0',
    fontSize: 15,
    fontWeight: '700',
    marginTop: 6,
  },
  memberTabRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
    marginBottom: 8,
  },
  memberTabBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#1f3b69',
    borderRadius: 8,
    backgroundColor: '#0f213f',
    paddingVertical: 8,
    alignItems: 'center',
  },
  memberTabBtnActive: {
    backgroundColor: '#1f4f96',
    borderColor: '#3f77bc',
  },
  memberTabText: {
    color: '#dbeafe',
    fontSize: 12,
    fontWeight: '700',
  },
  memberListWrap: {
    gap: 8,
    marginTop: 4,
  },
  memberItem: {
    borderWidth: 1,
    borderColor: '#1f3b69',
    backgroundColor: '#0f213f',
    borderRadius: 10,
    padding: 10,
    gap: 4,
  },
  memberItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  memberNameText: {
    color: '#e2e8f0',
    fontSize: 13,
    fontWeight: '700',
    flex: 1,
  },
  memberLevelText: {
    color: '#7dd3fc',
    fontSize: 11,
    fontWeight: '700',
  },
  memberWalletText: {
    color: '#93a9d1',
    fontSize: 11,
  },
  memberMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  memberMetaText: {
    color: '#cbd5e1',
    fontSize: 11,
  },
  memberJoinedText: {
    color: '#7a93c0',
    fontSize: 11,
  },
  memberErrorText: {
    color: '#fca5a5',
    fontSize: 12,
    lineHeight: 18,
  },
  memberPagerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
    gap: 10,
  },
  memberPagerBtn: {
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: '#3f77bc',
    backgroundColor: '#1f4f96',
  },
  memberPagerText: {
    color: '#e8fbff',
    fontSize: 12,
    fontWeight: '700',
  },
  memberPagerInfo: {
    color: '#93a9d1',
    fontSize: 12,
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
  versionText: {
    color: '#7a93c0',
    fontSize: 11,
    marginTop: 8,
    textAlign: 'center',
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
  balanceSection: {
    marginTop: 14,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#1f3b69',
    backgroundColor: '#0f213f',
    gap: 8,
  },
  balanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  balanceLabel: {
    color: '#93a9d1',
    fontSize: 13,
    fontWeight: '600',
  },
  balanceValue: {
    color: '#7dd3fc',
    fontSize: 13,
    fontWeight: '700',
  },
  walletActionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
  walletActionBtn: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: '#1f4f96',
    borderWidth: 1,
    borderColor: '#3f77bc',
    alignItems: 'center',
  },
  walletActionBtnText: {
    color: '#e8fbff',
    fontSize: 13,
    fontWeight: '700',
  },
  collapseHeaderBtn: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#1f3b69',
    backgroundColor: '#0f213f',
    paddingVertical: 10,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  collapseHeaderTitle: {
    color: '#e8fbff',
    fontSize: 14,
    fontWeight: '800',
  },
  collapseHeaderHint: {
    color: '#93a9d1',
    fontSize: 12,
    fontWeight: '700',
  },
  modalCardLarge: {
    width: '100%',
    maxWidth: 520,
    maxHeight: '86%',
    borderRadius: 16,
    padding: 18,
    backgroundColor: '#0b1a33',
    borderWidth: 1,
    borderColor: '#1f3b69',
    gap: 10,
  },
  agreementScroll: {
    maxHeight: 360,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#1f3b69',
    backgroundColor: '#0f213f',
  },
  agreementScrollContent: {
    padding: 12,
  },
  agreementBody: {
    color: '#d6e8ff',
    fontSize: 13,
    lineHeight: 20,
  },
  agreementRow: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#1f3b69',
    backgroundColor: '#0f213f',
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  agreementRowText: {
    flex: 1,
    gap: 4,
  },
  agreementRowLabel: {
    color: '#e8fbff',
    fontSize: 13,
    fontWeight: '700',
  },
  agreementRowStatus: {
    fontSize: 12,
    fontWeight: '700',
  },
  agreementRowStatusOk: {
    color: '#5eead4',
  },
  agreementRowStatusPending: {
    color: '#fbbf24',
  },
  agreementRowBtn: {
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#1f4f96',
    borderWidth: 1,
    borderColor: '#3f77bc',
  },
  agreementRowBtnGhost: {
    backgroundColor: '#0f213f',
    borderColor: '#3f77bc',
  },
  agreementRowBtnText: {
    color: '#e8fbff',
    fontSize: 12,
    fontWeight: '700',
  },
});
