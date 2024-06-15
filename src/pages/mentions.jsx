import { useMemo, useRef, useState } from 'preact/hooks';
import { useSearchParams } from 'react-router-dom';

import Link from '../components/link';
import Timeline from '../components/timeline';
import { api } from '../utils/api';
import { fixNotifications } from '../utils/group-notifications';
import { saveStatus } from '../utils/states';
import useTitle from '../utils/useTitle';

const LIMIT = 20;
const emptySearchParams = new URLSearchParams();

function Mentions({ columnMode, ...props }) {
  const { masto, instance } = api();
  const [searchParams] = columnMode ? [emptySearchParams] : useSearchParams();
  const [stateType, setStateType] = useState(null);
  const [conversationsImplemented, setConversationsImplemented] = useState(true);
  const type = props?.type || searchParams.get('type') || stateType;
  useTitle(`Mentions${type === 'private' ? ' (Private)' : ''}`, '/mentions');

  const mentionsIterator = useRef();
  const latestItem = useRef();

  async function fetchMentions(firstLoad) {
    if (firstLoad || !mentionsIterator.current) {
      mentionsIterator.current = masto.v1.notifications.list({
        limit: LIMIT,
        types: ['mention'],
      });
    }
    const results = await mentionsIterator.current.next();
    let { value } = results;
    if (value?.length) {
      value = fixNotifications(value);

      if (firstLoad) {
        latestItem.current = value[0].id;
        console.log('First load', latestItem.current);
      }

      value.forEach(({ status: item }) => {
        saveStatus(item, instance);
      });
    }
    return {
      ...results,
      value: value?.filter(item => item.type == "mention").map((item) => item.status), // GoToSocial returns even non-mentions types
    };
  }

  const conversationsIterator = useRef();
  const latestConversationItem = useRef();

  async function fetchConversations(firstLoad) {
    if (firstLoad || !conversationsIterator.current) {
      conversationsIterator.current = masto.v1.conversations.list({
        limit: LIMIT,
      });
    }
    let results;
    let statuses;
    try {
      results = await conversationsIterator.current.next();
      let { value } = results;
      if (firstLoad && value?.length) {
        latestConversationItem.current = value[0].lastStatus.id;
        console.log('First load backupApi', latestConversationItem.current);
      }
      statuses = value?.filter((item) => item.lastStatus && item.type == "mention").map((item) => item.lastStatus);
      setConversationsImplemented(true);
    }
    catch (e)
    {
      // Not supported api
      setConversationsImplemented(false);
      return {...true, value:[]};
    }
    if (statuses?.length) {
      statuses.forEach((status) => {
        saveStatus(status, instance);
      });
    }
    console.log('results', results);
    return {
      ...results,
      value: statuses,
    };
  }

  function fetchItems(...args) {
    if (type === 'private') {
      return fetchConversations(...args);
    }
    return fetchMentions(...args);
  }

  async function checkForUpdates() {
    if (type === 'private') {
      if (!conversationsImplemented){
        return false;
      }
      try {
        const results = await masto.v1.conversations
          .list({
            limit: 1,
            since_id: latestConversationItem.current,
          })
          .next();
        let { value } = results;
        console.log(
          'checkForUpdates PRIVATE',
          latestConversationItem.current,
          value,
        );
        const valueContainsLatestItem =
          value[0]?.id === latestConversationItem.current; // since_id might not be supported
        if (value?.length && !valueContainsLatestItem) {
          latestConversationItem.current = value[0].lastStatus.id;
          value = value?.filter((item) => item.lastStatus && item.type == "mention");
          if (value?.length)
          {
            return true;
          }
        }
        return false;
      } catch (e) {
        return false;
      }    
    } else {
      try {
        const results = await masto.v1.notifications
          .list({
            limit: 1,
            types: ['mention'],
            since_id: latestItem.current,
          })
          .next();
        let { value } = results;
        console.log('checkForUpdates ALL', latestItem.current, value);
        if (value?.length) {
          latestItem.current = value[0].id;
          value = value?.filter((item) => item.type == "mention");
          if (value?.length)
          {
            return true;
          }
        }
        return false;
      } catch (e) {
        return false;
      }
    }
  }

  const TimelineStart = useMemo(() => {
    return (
      <div class="filter-bar centered">
        <Link
          to="/mentions"
          class={!type ? 'is-active' : ''}
          onClick={(e) => {
            if (columnMode) {
              e.preventDefault();
              setStateType(null);
            }
          }}
        >
          All
        </Link>
        <Link
          to="/mentions?type=private"
          class={type === 'private' ? 'is-active' : ''}
          onClick={(e) => {
            if (columnMode) {
              e.preventDefault();
              setStateType('private');
            }
          }}
        >
          Private
        </Link>
      </div>
    );
  }, [type]);

  if (!conversationsImplemented && type === 'private') {
    return (
      <Timeline
        title="Mentions"
        id="mentions"
        emptyText="Conversation API is not implemented by this instance."
        errorText="Unable to load mentions."
        instance={instance}
        fetchItems={fetchItems}
        checkForUpdates={checkForUpdates}
        useItemID
        timelineStart={TimelineStart}
        refresh={type}
      />
    );
  }
  else {
    return (
      <Timeline
        title="Mentions"
        id="mentions"
        emptyText="No one mentioned you :("
        errorText="Unable to load mentions."
        instance={instance}
        fetchItems={fetchItems}
        checkForUpdates={checkForUpdates}
        useItemID
        timelineStart={TimelineStart}
        refresh={type}
      />
    );
  }
}

export default Mentions;
