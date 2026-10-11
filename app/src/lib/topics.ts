export interface Topic {
  id: string;
  label: string;
  /** Words that suggest someone is going through this, used to match "what's going on?" to topics. */
  keywords: string[];
}

export const TOPICS: Topic[] = [
  {
    id: 'grief',
    label: 'Missing them',
    keywords: ['miss', 'missing', 'grief', 'grieving', 'gone', 'lost', 'loss', 'died', 'funeral', 'passed', 'anniversary', 'mourning'],
  },
  {
    id: 'hard-times',
    label: 'Hard times',
    keywords: ['hard', 'struggling', 'struggle', 'tough', 'rough', 'overwhelmed', 'falling apart', 'give up', 'giving up', 'low', 'down', 'sad', 'depressed', 'tired', 'exhausted'],
  },
  {
    id: 'courage',
    label: 'Courage & fear',
    keywords: ['scared', 'afraid', 'fear', 'nervous', 'anxious', 'anxiety', 'worried', 'worry', 'brave', 'risk', 'interview', 'surgery', 'big decision'],
  },
  {
    id: 'love',
    label: 'Love & relationships',
    keywords: ['love', 'relationship', 'boyfriend', 'girlfriend', 'husband', 'wife', 'partner', 'marriage', 'married', 'wedding', 'breakup', 'broke up', 'divorce', 'dating', 'heartbreak'],
  },
  {
    id: 'family',
    label: 'Family',
    keywords: ['family', 'mom', 'dad', 'mother', 'father', 'sister', 'brother', 'siblings', 'cousin', 'grandma', 'grandpa', 'holiday', 'thanksgiving', 'christmas', 'reunion'],
  },
  {
    id: 'parenting',
    label: 'Raising kids',
    keywords: ['kid', 'kids', 'child', 'children', 'son', 'daughter', 'baby', 'parenting', 'teenager', 'toddler', 'pregnant'],
  },
  {
    id: 'work',
    label: 'Work & ambition',
    keywords: ['work', 'job', 'boss', 'career', 'fired', 'laid off', 'promotion', 'coworker', 'business', 'school', 'college', 'exam', 'study', 'quit'],
  },
  {
    id: 'money',
    label: 'Money',
    keywords: ['money', 'broke', 'debt', 'bills', 'rent', 'save', 'saving', 'savings', 'spend', 'spending', 'buy', 'loan', 'pay', 'budget'],
  },
  {
    id: 'forgiveness',
    label: 'Forgiveness & conflict',
    keywords: ['forgive', 'forgiveness', 'angry', 'anger', 'mad', 'fight', 'argument', 'grudge', 'hurt', 'betrayed', 'apologize', 'sorry', 'conflict'],
  },
  {
    id: 'self-worth',
    label: 'Believing in yourself',
    keywords: ['confidence', 'not good enough', 'doubt', 'failure', 'failed', 'ugly', 'compare', 'comparing', 'worthless', 'insecure', 'imposter'],
  },
  {
    id: 'health',
    label: 'Health & taking care',
    keywords: ['sick', 'health', 'doctor', 'hospital', 'diagnosis', 'sleep', 'eat', 'eating', 'exercise', 'pain', 'rest', 'stress'],
  },
  {
    id: 'faith',
    label: 'Faith & meaning',
    keywords: ['faith', 'god', 'pray', 'prayer', 'church', 'believe', 'purpose', 'meaning', 'why me', 'lost my way'],
  },
  {
    id: 'celebration',
    label: 'Good days',
    keywords: ['birthday', 'graduation', 'graduate', 'celebrate', 'proud', 'happy', 'won', 'new job', 'engaged', 'milestone'],
  },
  {
    id: 'everyday',
    label: 'Everyday wisdom',
    keywords: ['advice', 'life', 'lesson', 'remember', 'habit', 'manners', 'kitchen', 'cooking', 'recipe', 'house', 'car'],
  },
  {
    id: 'humor',
    label: 'Just for a laugh',
    keywords: ['laugh', 'funny', 'joke', 'smile', 'cheer up', 'silly'],
  },
];

const BY_ID = new Map(TOPICS.map((t) => [t.id, t]));

export function topicLabel(id: string): string {
  return BY_ID.get(id)?.label ?? id;
}
