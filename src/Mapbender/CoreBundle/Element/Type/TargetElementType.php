<?php

namespace Mapbender\CoreBundle\Element\Type;

use Doctrine\ORM\EntityManagerInterface;
use Doctrine\ORM\EntityRepository;
use Mapbender\Component\ClassUtil;
use Mapbender\CoreBundle\Element\EventListener\TargetElementSubscriber;
use Mapbender\CoreBundle\Entity\Application;
use Mapbender\CoreBundle\Component;
use Mapbender\CoreBundle\Extension\ElementExtension;
use Symfony\Bridge\Doctrine\Form\Type\EntityType;
use Symfony\Component\Form\AbstractType;
use Symfony\Component\Form\FormBuilderInterface;
use Symfony\Component\OptionsResolver\Options;
use Symfony\Component\OptionsResolver\OptionsResolver;
use Mapbender\CoreBundle\Form\DataTransformer\ElementIdTransformer;
use Symfony\Component\Form\FormInterface;
use Symfony\Component\Form\FormView;
use Symfony\Component\Translation\TranslatorInterface;

/**
 * Choice-style form element for picking an element's "target" element (this is used e.g. for a generic Button
 * controlling a functional Element like a FeatureInfo).
 *
 * @see EntityType
 */
class TargetElementType extends AbstractType
{
    /** @var EntityRepository */
    protected $repository;
    /** @var TranslatorInterface */
    protected $translator;
    /** @var ElementExtension */
    protected $elementExtension;

    public function __construct(TranslatorInterface $translator,
                                EntityManagerInterface $entityManager,
                                ElementExtension $elementExtension)
    {
        $this->translator = $translator;
        $this->repository = $entityManager->getRepository('Mapbender\CoreBundle\Entity\Element');
        $this->elementExtension = $elementExtension;
    }

    /**
     * @inheritdoc
     */
    public function getName()
    {
        // NOTE: alias is no longer used inside Mapbender, but is maintained
        //       for compatibility with a multitude of custom project elements.
        //       To minimize issues on planned / future Symfony upgrades, newly written
        //       code should use the FQCN, instead of the alias name, to reference
        //       this type,
        return 'target_element';
    }

    /**
     * @inheritdoc
     */
    public function getParent()
    {
        return 'Symfony\Bridge\Doctrine\Form\Type\EntityType';
    }

    /**
     * @inheritdoc
     */
    public function configureOptions(OptionsResolver $resolver)
    {
        $fixedParentOptions = array(
            'class' => 'Mapbender\CoreBundle\Entity\Element',
        );
        $type = $this;
        $elementExt = $this->elementExtension;
        $resolver->setDefaults($fixedParentOptions + array(
            'application' => null,
            'element_class' => null,
            'class' => 'Mapbender\CoreBundle\Entity\Element',
            'choice_label' => function($element) use ($elementExt) {
                return $element->getTitle() ?: $elementExt->element_default_title($element);
            },
            // @todo: provide placeholder translations
            'placeholder' => 'Choose an option',
            // Symfony does not recognize array-style callables
            'query_builder' => function(Options $options) use ($type) {
                return $type->getChoicesQueryBuilder($options);
            },
            'choice_translation_domain' => 'messages',
        ));
        $resolver->setAllowedValues('class', array($fixedParentOptions['class']));
        $resolver->setNormalizer('element_class', function(Options $options, $elementClassOption) {
            if (false !== strpos($elementClassOption, '%')) {
                return null;
            } else {
                return $elementClassOption ?: null;
            }
        });
    }

    /**
     * Returns the initialized query builder used for loading the target choices.
     *
     * @param Options $options
     * @return \Doctrine\ORM\QueryBuilder
     */
    public function getChoicesQueryBuilder(Options $options)
    {
        $builderName = '_target';
        /** @var Application $application */
        $application = $options['application'];
        $qb = $this->repository->createQueryBuilder($builderName);
        $applicationFilter = $qb->expr()->eq($builderName . '.application', $options['application']->getId());
        $filter = $qb->expr()->andX();
        $filter->add($applicationFilter);

        if (!empty($options['element_class'])) {
            $classComparison = $qb->expr()->eq($builderName . '.class', ':class');
            $filter->add($classComparison);
            $qb->setParameter('class', $options['element_class']);
        } else {
            $elementIds = array();
            foreach ($application->getElements() as $elementEntity) {
                /** @var Component\Element|string $elementComponentClass */
                $elementComponentClass = $elementEntity->getClass();
                if (ClassUtil::exists($elementComponentClass)) {
                    if ($elementComponentClass::$ext_api) {
                        $elementIds[] = $elementEntity->getId();
                    }
                }
            }

            if (!count($elementIds)) {
                // No targets available. Add an impossible condition to match nothing.
                $filter->add($qb->expr()->eq(1, 2));
            } else {
                $filter->add($qb->expr()->in($builderName . '.id', ':elm_ids'));
                $qb->setParameter('elm_ids', $elementIds);
            }
        }
        $qb->where($filter);
        return $qb;
    }

    /**
     * @inheritdoc
     */
    public function buildForm(FormBuilderInterface $builder, array $options)
    {
        $transformer = new ElementIdTransformer($this->repository);
        $builder->addModelTransformer($transformer);
        if (!empty($options['element_class']) && is_a('Mapbender\CoreBundle\Element\Map', $options['element_class'], true)) {
            $elementSubscriber = new TargetElementSubscriber($options['application'], $options['element_class']);
            $builder->addEventSubscriber($elementSubscriber);
        }
    }

    public function buildView(FormView $view, FormInterface $form, array $options)
    {
        $translator = $this->translator;
        $translatedLcLabels = array_map(function($element) use ($translator) {
            $transLabel = $translator->trans($element->label);
            // sorting should be case-insensitive
            return mb_strtolower($transLabel);
            }, $view->vars['choices']);
        // we use array_multisort instead of usort to avoid a bug in many
        // PHP5.x versions
        // see https://bugs.php.net/bug.php?id=50688
        array_multisort($view->vars['choices'], $translatedLcLabels);
    }
}
