import React, { useState, useCallback } from 'react';
import { 
  Dimensions,
  View
} from 'react-native';
import { 
  Column, 
  Row, 
  Spacer, 
  Icon, 
  ListItem, 
  HorizontalDivider, 
  LinearProgressIndicator, 
  Switch, 
  PullToRefreshBox,
  Text,
  Host,
  RNHostView
} from '@expo/ui/jetpack-compose';
import { 
  fillMaxSize, 
  fillMaxWidth, 
  padding, 
  background, 
  clickable, 
  horizontalScroll, 
  width as widthModifier, 
  height as heightModifier, 
  weight, 
  verticalScroll 
} from '@expo/ui/jetpack-compose/modifiers';
import { useJobJournalLibrary, useJobJournalOperations, useJobJournalStats } from '@/hooks';
import { useTheme } from '@/theme';
import { Image } from 'expo-image';

function getStatusColor(status: string) {
  switch (status) {
    case 'indexed': return '#22c55e'; // green
    case 'working': return '#3b82f6'; // blue
    case 'error': return '#ef4444'; // red
    default: return '#6b7280'; // gray
  }
}

export default function LibraryScreen() {
  const { items, loading, refresh } = useJobJournalLibrary();
  const { sync, isSyncing, isProcessing, retryFailed } = useJobJournalOperations();
  const stats = useJobJournalStats();
  const theme = useTheme();
  
  const [bgSync, setBgSync] = useState(true);

  const onRefresh = useCallback(async () => {
    await refresh();
  }, [refresh]);

  // Determine engine states for the primary status row
  const isActive = isProcessing || stats.running > 0 || stats.pending > 0;
  const isSync = isSyncing;
  const total = stats.totalJobs;
  const completed = stats.completed;
  const failed = stats.failed;

  let statusIcon = require('@/assets/photo_library.xml');
  let statusColor = theme.primary;
  let statusTitle = "Library Indexed";
  let statusSubtitle = `${total} screenshot${total === 1 ? '' : 's'} searchable`;

  if (isSync) {
    statusIcon = require('@/assets/sync.xml');
    statusColor = theme.secondary;
    statusTitle = "Syncing Camera Roll...";
    statusSubtitle = "Scanning for new screenshots";
  } else if (isActive) {
    statusIcon = require('@/assets/autorenew.xml');
    statusColor = theme.primary;
    statusTitle = "Analyzing Screenshots...";
    statusSubtitle = `${stats.pending + stats.running} item${(stats.pending + stats.running) === 1 ? '' : 's'} remaining`;
  } else if (failed > 0) {
    statusIcon = require('@/assets/warning.xml');
    statusColor = theme.error;
    statusTitle = `${failed} Indexing Failure${failed === 1 ? '' : 's'}`;
    statusSubtitle = "Tap 'Retry' to re-run processing";
  } else {
    statusIcon = require('@/assets/photo_library.xml');
    statusColor = theme.primary;
    statusTitle = "All Caught Up";
    statusSubtitle = `${total} screenshot${total === 1 ? '' : 's'} indexed & searchable`;
  }

  return (
    <Host style={{ flex: 1, backgroundColor: theme.background }} matchContents={false}>
      <PullToRefreshBox
        isRefreshing={loading}
        onRefresh={onRefresh}
        modifiers={[fillMaxSize()]}
        indicator={{
          color: theme.primary,
          containerColor: theme.surfaceVariant
        }}
      >
        <Column modifiers={[fillMaxSize(), verticalScroll(), background(theme.background)]}>
          {/* Primary Status Row (Implicit Containment) */}
          <Row 
            modifiers={[fillMaxWidth(), padding(16, 24, 16, 16)]} 
            verticalAlignment="center"
          >
            <Icon 
              source={statusIcon} 
              size={32} 
              tint={statusColor} 
            />
            <Spacer modifiers={[widthModifier(16)]} />
            <Column modifiers={[weight(1)]}>
              <Text 
                style={{ typography: 'headlineSmall', fontWeight: 'bold' }} 
                color={theme.onSurface}
              >
                {statusTitle}
              </Text>
              <Text 
                style={{ typography: 'bodyMedium' }} 
                color={theme.onSurfaceVariant}
              >
                {statusSubtitle}
              </Text>
            </Column>
          </Row>

          {/* Thin M3 Linear Progress Bar during activity */}
          {isActive && (
            <Column modifiers={[fillMaxWidth(), padding(16, 0, 16, 16)]}>
              <LinearProgressIndicator 
                progress={total > 0 ? completed / total : 0}
                color={theme.primary}
                trackColor={theme.surfaceVariant}
                modifiers={[fillMaxWidth(), heightModifier(4)]}
              />
            </Column>
          )}

          <HorizontalDivider thickness={1} color={theme.outlineVariant} modifiers={[fillMaxWidth()]} />

          {/* Control & Actions List */}
          <Column modifiers={[fillMaxWidth()]}>
            {/* Action 1: Sync Library */}
            <ListItem 
              modifiers={[
                fillMaxWidth(), 
                clickable(async () => {
                  if (!isSyncing) {
                    await sync();
                  }
                })
              ]}
            >
              <ListItem.LeadingContent>
                <Icon source={require('@/assets/sync.xml')} tint={theme.primary} size={24} />
              </ListItem.LeadingContent>
              <ListItem.HeadlineContent>
                <Text style={{ typography: 'titleMedium', fontWeight: 'bold' }} color={theme.onSurface}>
                  Scan photo library
                </Text>
              </ListItem.HeadlineContent>
              <ListItem.SupportingContent>
                <Text style={{ typography: 'bodyMedium' }} color={theme.onSurfaceVariant}>
                  Scan camera roll manually for new screenshots
                </Text>
              </ListItem.SupportingContent>
            </ListItem>
            
            <HorizontalDivider thickness={1} color={theme.outlineVariant} modifiers={[fillMaxWidth(), padding(56, 0, 0, 0)]} />

            {/* Action 2: Retry Failures */}
            {failed > 0 && (
              <>
                <ListItem 
                  modifiers={[
                    fillMaxWidth(), 
                    clickable(async () => {
                      await retryFailed();
                    })
                  ]}
                >
                  <ListItem.LeadingContent>
                    <Icon source={require('@/assets/warning.xml')} tint={theme.error} size={24} />
                  </ListItem.LeadingContent>
                  <ListItem.HeadlineContent>
                    <Text style={{ typography: 'titleMedium', fontWeight: 'bold' }} color={theme.onSurface}>
                      Retry indexing failures
                    </Text>
                  </ListItem.HeadlineContent>
                  <ListItem.SupportingContent>
                    <Text style={{ typography: 'bodyMedium' }} color={theme.onSurfaceVariant}>
                      {`Re-run analysis on the ${failed} failed screenshot${failed === 1 ? '' : 's'}`}
                    </Text>
                  </ListItem.SupportingContent>
                </ListItem>
                <HorizontalDivider thickness={1} color={theme.outlineVariant} modifiers={[fillMaxWidth(), padding(56, 0, 0, 0)]} />
              </>
            )}

            {/* Action 3: Background Toggle */}
            <ListItem modifiers={[fillMaxWidth()]}>
              <ListItem.LeadingContent>
                <Icon source={require('@/assets/photo_library.xml')} tint={theme.secondary} size={24} />
              </ListItem.LeadingContent>
              <ListItem.HeadlineContent>
                <Text style={{ typography: 'titleMedium', fontWeight: 'bold' }} color={theme.onSurface}>
                  Background indexing
                </Text>
              </ListItem.HeadlineContent>
              <ListItem.SupportingContent>
                <Text style={{ typography: 'bodyMedium' }} color={theme.onSurfaceVariant}>
                  Scan and index new screenshots in background
                </Text>
              </ListItem.SupportingContent>
              <ListItem.TrailingContent>
                <Switch 
                  value={bgSync} 
                  onCheckedChange={(val) => setBgSync(val)}
                />
              </ListItem.TrailingContent>
            </ListItem>
            
            <HorizontalDivider thickness={1} color={theme.outlineVariant} modifiers={[fillMaxWidth()]} />
          </Column>

          <Spacer modifiers={[heightModifier(24)]} />

          {/* Section: Live Activity Peek */}
          <Text 
            style={{ typography: 'labelLarge', fontWeight: 'bold' }} 
            color={theme.primary}
            modifiers={[padding(16, 0, 16, 8)]}
          >
            RECENT ACTIVITY
          </Text>

          {items.length === 0 ? (
            <Column modifiers={[fillMaxWidth(), padding(16, 24, 16, 24)]} horizontalArrangement="center">
              <Text style={{ typography: 'bodyMedium' }} color={theme.onSurfaceVariant}>
                No screenshots indexed yet.
              </Text>
            </Column>
          ) : (
            <Row 
              modifiers={[
                fillMaxWidth(), 
                horizontalScroll(), 
                padding(16, 8, 16, 16)
              ]}
            >
              {items.slice(0, 12).map((item) => (
                <RNHostView key={item.id} matchContents={true}>
                  <View 
                    style={{ 
                      marginRight: 12, 
                      width: 80, 
                      height: 120, 
                      borderRadius: 8, 
                      overflow: 'hidden', 
                      backgroundColor: theme.surfaceVariant,
                      position: 'relative'
                    }}
                  >
                    <Image 
                      source={{ uri: item.uri }} 
                      style={{ width: '100%', height: '100%' }}
                      contentFit="cover"
                      transition={200}
                    />
                    {/* Status Indicator Dot */}
                    <View 
                      style={{ 
                        position: 'absolute', 
                        top: 6, 
                        right: 6, 
                        width: 8, 
                        height: 8, 
                        borderRadius: 4, 
                        backgroundColor: getStatusColor(item.status),
                        borderWidth: 1,
                        borderColor: theme.background
                      }} 
                    />
                  </View>
                </RNHostView>
              ))}
            </Row>
          )}
        </Column>
      </PullToRefreshBox>
    </Host>
  );
}
